// model.js — предметная область. Чистые функции над состоянием: ни DOM, ни IndexedDB.
// Всё, что считает деньги, живёт здесь и в money.js, и покрыто тестами в tests/.

import { convert, allocate, sum } from './money.js';

export const ACCOUNT_KINDS = { CARD: 'card', CASH: 'cash', KITTY: 'kitty' };
export const SPLIT = { EQUAL: 'equal', EXACT: 'exact', SHARES: 'shares', PERCENT: 'percent' };

/** Короткий сортируемый id: время + случайный хвост. */
export function newId(prefix = 'x') {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}${r}`;
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Сдвиг даты на N дней. Считается в UTC намеренно: календарная дата — не момент
 * времени, а арифметика по местному времени в день перевода часов даёт либо то же
 * самое число, либо прыжок через день (D-014).
 */
export function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/* ------------------------------------------------------------------ helpers */

export const alive = (list) => (list || []).filter((r) => !r.deleted);

export function byId(list, id) {
  return (list || []).find((r) => r.id === id) || null;
}

export function accountCurrency(state, accountId) {
  const a = byId(state.accounts, accountId);
  return a ? a.currency : state.trip.homeCurrency;
}

/**
 * Курс валюты к домашней для этой поездки.
 * Домашняя валюта — всегда "1". Остальное берётся из таблицы курсов поездки,
 * которую человек заполняет руками. Сети не требуется никогда (D-004).
 */
export function rateFor(state, code) {
  if (code === state.trip.homeCurrency) return '1';
  const r = state.rates && state.rates[code];
  return r || null;
}

/** Перевод в домашнюю валюту по текущему курсу поездки (для НЕзамороженных величин). */
export function toHome(state, minor, code) {
  if (code === state.trip.homeCurrency) return minor;
  const r = rateFor(state, code);
  if (!r) return null; // курс не задан — честно возвращаем null, а не ноль
  return convert(minor, code, r, state.trip.homeCurrency);
}

/* ------------------------------------------------------- expense derivation */

/**
 * Доли траты в ДОМАШНЕЙ валюте.
 * Считаются распределением замороженного `amountHome` по весам долей, а не
 * конвертацией каждой доли по отдельности — иначе сумма долей разъезжается
 * с итогом на копейку (D-003).
 */
export function homeShares(expense) {
  const weights = expense.shares.map((s) => Math.abs(s.amount));
  const parts = allocate(expense.amountHome, weights);
  return expense.shares.map((s, i) => ({ personId: s.personId, amount: parts[i] }));
}

/** Вклад каждого плательщика в домашней валюте — тем же распределением. */
export function homePayers(expense) {
  const weights = expense.payers.map((p) => Math.abs(p.amount));
  const parts = allocate(expense.amountHome, weights);
  return expense.payers.map((p, i) => ({ ...p, amountHome: parts[i] }));
}

/** Фактический курс карты, если списали в валюте счёта, отличной от валюты траты. */
export function cardRateOf(expense, payer, state) {
  if (payer.chargedAmount == null) return null;
  const accCur = accountCurrency(state, payer.accountId);
  if (accCur === expense.currency) return null;
  return { from: expense.currency, to: accCur, out: payer.chargedAmount, in: payer.amount };
}

/* --------------------------------------------------------- account balances */

/**
 * Остаток по каждому счёту в валюте счёта.
 * Трата списывает с счёта плательщика ровно то, что списал банк
 * (`chargedAmount`), а не пересчёт по курсу траты — иначе остаток не сойдётся
 * с выпиской (D-005).
 */
export function accountBalances(state) {
  const out = {};
  for (const a of alive(state.accounts)) out[a.id] = a.opening || 0;

  for (const e of alive(state.expenses)) {
    for (const p of e.payers) {
      if (!(p.accountId in out)) continue;
      const charged = p.chargedAmount != null ? p.chargedAmount : p.amount;
      out[p.accountId] -= charged;
    }
  }

  for (const t of alive(state.transfers)) {
    if (t.fromAccountId in out) out[t.fromAccountId] -= (t.amountOut + (t.feeAmount || 0));
    if (t.toAccountId in out) out[t.toAccountId] += t.amountIn;
  }

  for (const s of alive(state.settlements)) {
    if (s.fromAccountId && s.fromAccountId in out) out[s.fromAccountId] -= s.amount;
    if (s.toAccountId && s.toAccountId in out) out[s.toAccountId] += s.amount;
  }

  return out;
}

/**
 * Следит ли счёт за остатком.
 *
 * Наличные и общая касса — да: смысл в том, сколько ещё осталось в кармане.
 * Карта — нет: настоящий остаток лежит в банке, а не здесь, и показывать по ней
 * «−20 000 ₽» значит утверждать, что у человека минус двадцать тысяч. Карта просто
 * копит траты (D-011). Флаг можно переопределить вручную для каждого счёта.
 */
export function tracksBalance(account) {
  if (!account) return false;
  if (typeof account.tracksBalance === 'boolean') return account.tracksBalance;
  return account.kind !== ACCOUNT_KINDS.CARD;
}

/**
 * Сколько денег на руках — в домашней валюте.
 * Считаются только счета, следящие за остатком: карты сюда не входят.
 * null, если какого-то курса не хватает.
 */
export function totalOnHand(state) {
  const bal = accountBalances(state);
  let total = 0;
  for (const a of alive(state.accounts)) {
    if (!tracksBalance(a)) continue;
    const h = toHome(state, bal[a.id] || 0, a.currency);
    if (h === null) return null;
    total += h;
  }
  return total;
}

/**
 * Сколько ДЕЙСТВИТЕЛЬНО потрачено с этого счёта за поездку.
 *
 * Считаются оплаченные с него траты и комиссии банка. Не считаются переводы на
 * свои же счета: снять 20 000 ₽ в банкомате — это не расход, деньги никуда не
 * делись, они просто стали наличными. Иначе одни и те же деньги были бы
 * «потрачены» на карте и одновременно лежали бы «на руках».
 */
export function spentFrom(state, accountId) {
  let spent = 0;

  for (const e of alive(state.expenses)) {
    for (const p of e.payers) {
      if (p.accountId !== accountId) continue;
      spent += p.chargedAmount != null ? p.chargedAmount : p.amount;
    }
  }

  // Комиссия — настоящая потеря денег, в отличие от самого перевода.
  for (const t of alive(state.transfers)) {
    if (t.fromAccountId === accountId) spent += (t.feeAmount || 0);
  }

  return spent;
}

/* -------------------------------------------------------------- who owes whom */

/**
 * Чистая позиция каждого участника в домашней валюте.
 *
 *   net[p] = (заплатил напрямую) + (внёс в общую кассу) − (его доля в тратах)
 *
 * Отсюда следует тождество, на которое опирается весь расчёт:
 *   Σ net = остаток общей кассы в домашней валюте.
 * Если общей кассы нет, Σ net = 0 и итог сходится сам.
 *
 * Возвращает подробности, а не одно число, — потому что «кто кому должен»
 * обязано раскрываться по тапу (жалоба на «чёрный ящик» Splitwise).
 */
export function netPositions(state) {
  const people = alive(state.people);
  const net = {};
  const paid = {};        // всё, что человек внёс: траты + переводы + расчёты
  const paidExpenses = {};// только оплата общих трат
  const paidSettled = {}; // только возвраты долга (расчёты и переводы человеку)
  const shareOf = {};
  const kitty = {};
  for (const p of people) {
    net[p.id] = 0; paid[p.id] = 0; paidExpenses[p.id] = 0;
    paidSettled[p.id] = 0; shareOf[p.id] = 0; kitty[p.id] = 0;
  }

  const missingRates = new Set();

  for (const e of alive(state.expenses)) {
    for (const hp of homePayers(e)) {
      if (hp.personId && hp.personId in paid) {
        paid[hp.personId] += hp.amountHome;
        paidExpenses[hp.personId] += hp.amountHome;
      }
    }
    for (const hs of homeShares(e)) {
      if (hs.personId in shareOf) shareOf[hs.personId] += hs.amount;
    }
  }

  for (const t of alive(state.transfers)) {
    const from = byId(state.accounts, t.fromAccountId);
    const to = byId(state.accounts, t.toAccountId);
    if (!from || !to) continue;

    const outHome = toHome(state, t.amountOut + (t.feeAmount || 0), from.currency);
    if (outHome === null) { missingRates.add(from.currency); continue; }

    const fromKitty = from.kind === ACCOUNT_KINDS.KITTY;
    const toKitty = to.kind === ACCOUNT_KINDS.KITTY;

    if (!fromKitty && toKitty && from.ownerId) {
      // Взнос в общую кассу — это оплата вперёд, а не расход.
      // Считается по ТОЙ СТОРОНЕ, что легла в кассу: вы внесли то, что получил
      // общий котёл, а не то, что списалось у вас. Разницу съел обменник, и она
      // видна отдельной строкой как `fxDrift`, а не размазывается по долгам (D-007).
      const inHome = toHome(state, t.amountIn, to.currency);
      if (inHome === null) { missingRates.add(to.currency); continue; }
      kitty[from.ownerId] = (kitty[from.ownerId] || 0) + inHome;
    } else if (fromKitty && !toKitty && to.ownerId) {
      // Забрали из кассы себе — взнос уменьшается на то, что ушло из кассы.
      const goneHome = toHome(state, t.amountOut + (t.feeAmount || 0), from.currency);
      if (goneHome === null) { missingRates.add(from.currency); continue; }
      kitty[to.ownerId] = (kitty[to.ownerId] || 0) - goneHome;
    } else if (from.ownerId && to.ownerId && from.ownerId !== to.ownerId) {
      // Перевод между людьми — это возврат долга, даже если его так не назвали.
      paid[from.ownerId] += outHome;
      paid[to.ownerId] -= outHome;
      paidSettled[from.ownerId] += outHome;
      paidSettled[to.ownerId] -= outHome;
    }
    // Перевод между своими счетами (обмен валюты, снятие в банкомате)
    // на долги не влияет вообще — меняется только остаток счетов.
  }

  for (const s of alive(state.settlements)) {
    const h = s.amountHome;
    if (s.fromPersonId in paid) { paid[s.fromPersonId] += h; paidSettled[s.fromPersonId] += h; }
    if (s.toPersonId in paid) { paid[s.toPersonId] -= h; paidSettled[s.toPersonId] -= h; }
  }

  for (const p of people) {
    net[p.id] = paid[p.id] + kitty[p.id] - shareOf[p.id];
  }

  return { net, paid, paidExpenses, paidSettled, shareOf, kitty, missingRates: [...missingRates] };
}

/** Остаток общей кассы в домашней валюте (0, если кассы нет). */
export function kittyBalanceHome(state) {
  const bal = accountBalances(state);
  let total = 0;
  for (const a of alive(state.accounts)) {
    if (a.kind !== ACCOUNT_KINDS.KITTY) continue;
    const h = toHome(state, bal[a.id] || 0, a.currency);
    if (h === null) return null;
    total += h;
  }
  return total;
}

/**
 * Итоговый расчёт: кто кому сколько должен, одной строкой и с разбивкой.
 *
 * @param {object} state
 * @param {'contribution'|'equal'} kittyMode как делить остаток общей кассы
 */
export function settlementPlan(state, kittyMode = 'contribution') {
  const people = alive(state.people);
  const { net, paid, paidExpenses, paidSettled, shareOf, kitty, missingRates } = netPositions(state);

  // Нераспределённый остаток — это в точности сумма позиций. Делим ИМЕННО его,
  // поэтому `final` всегда сходится в ноль, сколько бы курсов ни было заморожено.
  const pool = sum(people.map((p) => net[p.id]));

  // Сколько физически лежит в общей кассе сегодня. Может слегка расходиться
  // с `pool`: замороженные курсы операций против текущего курса поездки.
  const onHand = kittyBalanceHome(state);
  const fxDrift = onHand === null ? null : pool - onHand;

  // Остаток возвращается вносившим — по взносам либо поровну.
  const refund = {};
  for (const p of people) refund[p.id] = 0;
  if (pool !== 0 && people.length) {
    const contributed = people.map((p) => Math.max(0, kitty[p.id] || 0));
    const anyContribution = contributed.some((x) => x > 0);
    const weights = (kittyMode === 'equal' || !anyContribution)
      ? people.map(() => 1)
      : contributed;
    const parts = allocate(pool, weights);
    people.forEach((p, i) => { refund[p.id] = parts[i]; });
  }

  const final = {};
  for (const p of people) final[p.id] = net[p.id] - refund[p.id];

  // Прямой расчёт, без «упрощения долгов»: должники платят кредиторам.
  const debtors = people.filter((p) => final[p.id] < 0)
    .map((p) => ({ id: p.id, amount: -final[p.id] }))
    .sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));
  const creditors = people.filter((p) => final[p.id] > 0)
    .map((p) => ({ id: p.id, amount: final[p.id] }))
    .sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));

  const transfers = [];
  let di = 0; let ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const amount = Math.min(debtors[di].amount, creditors[ci].amount);
    if (amount > 0) {
      transfers.push({ fromPersonId: debtors[di].id, toPersonId: creditors[ci].id, amount });
    }
    debtors[di].amount -= amount;
    creditors[ci].amount -= amount;
    if (debtors[di].amount === 0) di += 1;
    if (creditors[ci].amount === 0) ci += 1;
  }

  return {
    net, paid, paidExpenses, paidSettled, shareOf, kitty, refund, final, transfers, missingRates,
    leftover: pool,
    kittyOnHand: onHand,
    fxDrift,
    settled: transfers.length === 0,
  };
}

/* ------------------------------------------------------------------ totals */

export function tripTotals(state) {
  const live = alive(state.expenses);
  let spent = 0;
  const byCategory = {};
  const byPerson = {};
  const byCurrency = {};
  for (const p of alive(state.people)) byPerson[p.id] = 0;

  for (const e of live) {
    spent += e.amountHome;
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.amountHome;
    byCurrency[e.currency] = (byCurrency[e.currency] || 0) + e.amount;
    for (const hs of homeShares(e)) {
      if (hs.personId in byPerson) byPerson[hs.personId] += hs.amount;
    }
  }

  const days = tripDays(state, live);
  return {
    spent,
    count: live.length,
    byCategory,
    byPerson,
    byCurrency,
    days,
    perDay: days > 0 ? Math.round(spent / days) : 0,
  };
}

/** Длительность поездки в днях — по датам поездки, иначе по разбросу трат. */
export function tripDays(state, expenses) {
  const list = expenses || alive(state.expenses);
  const dates = list.map((e) => e.date).filter(Boolean).sort();
  const start = state.trip.startDate || dates[0];
  if (!start) return 0;
  const end = state.trip.endDate || dates[dates.length - 1] || todayISO();
  const today = todayISO();
  const effectiveEnd = end > today ? today : end;
  if (effectiveEnd < start) return 1;
  const ms = Date.parse(`${effectiveEnd}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.floor(ms / 86400000) + 1;
}
