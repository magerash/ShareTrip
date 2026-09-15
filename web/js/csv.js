// csv.js — экспорт в CSV. Бесплатно и в MVP: конкуренты прячут это за пейволл,
// а именно по этому файлу сверяют поездку в таблице после возвращения.

import { formatAmount, decimalsOf } from './money.js';
import { alive, byId, homeShares, homePayers, accountBalances, toHome, settlementPlan } from './model.js';

/** Экранирование по RFC 4180 + разделитель ';' — Excel с русской локалью ждёт его. */
function cell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rows2csv(rows) {
  return rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

/** Число для таблицы: запятая-разделитель, без разрядов, чтобы Excel понял. */
function num(minor, code) {
  const d = decimalsOf(code);
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** d);
  if (d === 0) return `${sign}${whole}`;
  const frac = String(abs % 10 ** d).padStart(d, '0');
  return `${sign}${whole},${frac}`;
}

const nameOf = (list, id, dash = '—') => (byId(list, id)?.name) || dash;

/** Траты: одна строка на трату, доли и плательщики — отдельными колонками. */
export function expensesCSV(state) {
  const home = state.trip.homeCurrency;
  const people = alive(state.people);

  const head = [
    'Дата', 'Название', 'Категория', 'Валюта', 'Сумма', 'Курс', `Сумма, ${home}`,
    'Плательщики', 'Как делили',
    ...people.map((p) => `Доля: ${p.name}, ${home}`),
    ...people.map((p) => `Заплатил: ${p.name}, ${home}`),
    'Заметка',
  ];

  const rows = [head];
  const sorted = alive(state.expenses).slice().sort((a, b) => a.date.localeCompare(b.date));

  for (const e of sorted) {
    const hs = homeShares(e);
    const hp = homePayers(e);
    const shareMap = Object.fromEntries(hs.map((x) => [x.personId, x.amount]));
    const paidMap = {};
    for (const p of hp) {
      if (p.personId) paidMap[p.personId] = (paidMap[p.personId] || 0) + p.amountHome;
    }
    const payersText = e.payers.map((p) => {
      const who = p.personId ? nameOf(state.people, p.personId) : 'Общая касса';
      return `${who}: ${formatAmount(p.amount, e.currency)} ${e.currency}`;
    }).join(' + ');

    rows.push([
      e.date,
      e.title,
      nameOf(state.categories, e.categoryId),
      e.currency,
      num(e.amount, e.currency),
      e.rate,
      num(e.amountHome, home),
      payersText,
      SPLIT_LABEL[e.splitMode] || e.splitMode || '',
      ...people.map((p) => num(shareMap[p.id] || 0, home)),
      ...people.map((p) => num(paidMap[p.id] || 0, home)),
      e.note || '',
    ]);
  }
  return rows2csv(rows);
}

const SPLIT_LABEL = {
  equal: 'поровну',
  exact: 'точные суммы',
  shares: 'доли',
  percent: 'проценты',
};

/** Переводы между счетами: обмен валюты, снятие в банкомате, взносы в кассу. */
export function transfersCSV(state) {
  const head = [
    'Дата', 'Откуда', 'Куда', 'Валюта списания', 'Ушло', 'Валюта зачисления',
    'Пришло', 'Комиссия', 'Фактический курс', 'Заметка',
  ];
  const rows = [head];
  const sorted = alive(state.transfers).slice().sort((a, b) => a.date.localeCompare(b.date));

  for (const t of sorted) {
    const from = byId(state.accounts, t.fromAccountId);
    const to = byId(state.accounts, t.toAccountId);
    rows.push([
      t.date,
      from?.name || '—',
      to?.name || '—',
      from?.currency || '',
      num(t.amountOut, from?.currency || 'RUB'),
      to?.currency || '',
      num(t.amountIn, to?.currency || 'RUB'),
      t.feeAmount ? num(t.feeAmount, from?.currency || 'RUB') : '',
      t.rate || '',
      t.note || '',
    ]);
  }
  return rows2csv(rows);
}

/** Счета и остатки — то, что сверяют с кошельком и выпиской. */
export function accountsCSV(state) {
  const home = state.trip.homeCurrency;
  const bal = accountBalances(state);
  const head = ['Счёт', 'Владелец', 'Тип', 'Валюта', 'Начальный остаток', 'Остаток', `Остаток, ${home}`];
  const rows = [head];
  const KIND = { card: 'карта', cash: 'наличные', kitty: 'общая касса' };

  for (const a of alive(state.accounts)) {
    const h = toHome(state, bal[a.id] || 0, a.currency);
    rows.push([
      a.name,
      a.ownerId ? nameOf(state.people, a.ownerId) : 'общий',
      KIND[a.kind] || a.kind,
      a.currency,
      num(a.opening || 0, a.currency),
      num(bal[a.id] || 0, a.currency),
      h === null ? 'курс не задан' : num(h, home),
    ]);
  }
  return rows2csv(rows);
}

/** Итоговый расчёт — лист, который читают последним. */
export function settlementCSV(state, kittyMode) {
  const home = state.trip.homeCurrency;
  const plan = settlementPlan(state, kittyMode);
  const rows = [['Участник', `Заплатил, ${home}`, `Внёс в кассу, ${home}`, `Его доля, ${home}`, `Позиция, ${home}`, `Возврат из кассы, ${home}`, `Итог, ${home}`]];

  for (const p of alive(state.people)) {
    rows.push([
      p.name,
      num(plan.paid[p.id] || 0, home),
      num(plan.kitty[p.id] || 0, home),
      num(plan.shareOf[p.id] || 0, home),
      num(plan.net[p.id] || 0, home),
      num(plan.refund[p.id] || 0, home),
      num(plan.final[p.id] || 0, home),
    ]);
  }

  rows.push([]);
  rows.push(['Кто', 'Кому', `Сколько, ${home}`]);
  if (plan.transfers.length === 0) {
    rows.push(['—', '—', '0 (всё рассчитано)']);
  }
  for (const t of plan.transfers) {
    rows.push([nameOf(state.people, t.fromPersonId), nameOf(state.people, t.toPersonId), num(t.amount, home)]);
  }
  return rows2csv(rows);
}

/** Всё вместе одним файлом, листы разделены пустой строкой и заголовком. */
export function fullCSV(state, kittyMode) {
  return [
    `# ShareTrip — ${state.trip.name}`,
    `# Домашняя валюта: ${state.trip.homeCurrency}`,
    '',
    '## ТРАТЫ',
    expensesCSV(state),
    '',
    '## ПЕРЕВОДЫ',
    transfersCSV(state),
    '',
    '## СЧЕТА',
    accountsCSV(state),
    '',
    '## РАСЧЁТ',
    settlementCSV(state, kittyMode),
  ].join('\r\n');
}
/**
 * Можно ли вообще скачать файл.
 * Внутри встроенного просмотрщика (iframe в песочнице) ссылка `download`
 * молча ничего не делает — там единственный способ забрать данные — показать
 * текст и дать его скопировать (A-002).
 */
export function canDownload() {
  try {
    return window.self === window.top;
  } catch {
    return false; // доступ к window.top запрещён — значит мы в чужом фрейме
  }
}

/** BOM обязателен: без него Excel открывает кириллицу кракозябрами. */
export function withBOM(text) {
  return BOM_CHAR + text;
}

const BOM_CHAR = '\ufeff';

export function downloadCSV(filename, text) {
  return triggerDownload(filename, new Blob([withBOM(text)], { type: 'text/csv;charset=utf-8' }));
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  return triggerDownload(filename, blob);
}

/** @returns {boolean} удалось ли начать скачивание */
function triggerDownload(filename, blob) {
  if (!canDownload()) return false;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    return false;
  }
}
