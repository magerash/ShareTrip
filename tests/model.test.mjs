// Тесты предметной модели: остатки счетов, «кто кому должен», общая касса.
// Эталонный сценарий из исследования (раздел Recommendations, п.1) — в конце файла.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, impliedRate, sum } from '../web/js/money.js';
import {
  accountBalances, netPositions, settlementPlan, kittyBalanceHome,
  homeShares, homePayers, tripTotals, SPLIT, ACCOUNT_KINDS,
} from '../web/js/model.js';
import {
  buildShares, sharesWithPersonalItem, validateExpense,
} from '../web/js/split.js';

const A = 'p_ksusha';
const V = 'p_vova';

function baseState(over = {}) {
  return {
    trip: { id: 't1', name: 'Баку', homeCurrency: 'RUB', startDate: '2026-09-01', endDate: '2026-09-10' },
    people: [{ id: A, name: 'Ксюша' }, { id: V, name: 'Вова' }],
    accounts: [
      { id: 'a_card', name: 'Карта Ксюши', ownerId: A, kind: ACCOUNT_KINDS.CARD, currency: 'RUB', opening: 10000000 },
      { id: 'v_card', name: 'Карта Вовы', ownerId: V, kind: ACCOUNT_KINDS.CARD, currency: 'RUB', opening: 10000000 },
      { id: 'a_azn', name: 'Наличные Ксюши', ownerId: A, kind: ACCOUNT_KINDS.CASH, currency: 'AZN', opening: 0 },
      { id: 'v_azn', name: 'Наличные Вовы', ownerId: V, kind: ACCOUNT_KINDS.CASH, currency: 'AZN', opening: 0 },
    ],
    categories: [{ id: 'c_food', name: 'Еда' }],
    expenses: [],
    transfers: [],
    settlements: [],
    rates: { AZN: '48.5' },
    ...over,
  };
}

function expense(over = {}) {
  const e = {
    id: 'e1', date: '2026-09-02', title: 'Ужин', categoryId: 'c_food',
    currency: 'RUB', amount: 100000, rate: '1', amountHome: 100000,
    payers: [{ accountId: 'a_card', personId: A, amount: 100000 }],
    shares: [{ personId: A, amount: 50000 }, { personId: V, amount: 50000 }],
    splitMode: SPLIT.EQUAL,
    ...over,
  };
  return e;
}

/* ----------------------------------------------------------------- balances */

test('остаток счёта: трата списывает, перевод двигает', () => {
  const s = baseState();
  s.expenses = [expense()];
  s.transfers = [{
    id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'a_azn',
    amountOut: 2000000, amountIn: 41200, feeAmount: 0,
  }];
  const b = accountBalances(s);
  assert.equal(b.a_card, 10000000 - 100000 - 2000000, 'карта Ани');
  assert.equal(b.a_azn, 41200, '412 AZN на руках');
  assert.equal(b.v_card, 10000000, 'чужой счёт не тронут');
});

test('остаток счёта: комиссия за перевод списывается с отправителя', () => {
  const s = baseState();
  s.transfers = [{
    id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'a_azn',
    amountOut: 1000000, amountIn: 20600, feeAmount: 15000,
  }];
  const b = accountBalances(s);
  assert.equal(b.a_card, 10000000 - 1000000 - 15000);
  assert.equal(b.a_azn, 20600);
});

test('остаток счёта: удалённые записи не учитываются', () => {
  const s = baseState();
  s.expenses = [expense(), expense({ id: 'e2', deleted: true })];
  assert.equal(accountBalances(s).a_card, 10000000 - 100000);
});

test('DCC: с карты списали в валюте счёта, остаток совпадает с выпиской', () => {
  const s = baseState();
  // Чек на 100 AZN, но рублёвая карта списала 4 980 ₽ по своему курсу.
  s.expenses = [expense({
    currency: 'AZN', amount: 10000, rate: '48.5', amountHome: 485000,
    payers: [{ accountId: 'a_card', personId: A, amount: 10000, chargedAmount: 498000 }],
    shares: [{ personId: A, amount: 5000 }, { personId: V, amount: 5000 }],
  })];
  const b = accountBalances(s);
  assert.equal(b.a_card, 10000000 - 498000, 'списано ровно то, что списал банк');
  // А делится всё равно стоимость чека по замороженному курсу траты.
  const { net } = netPositions(s);
  assert.equal(net[A], 485000 - 242500);
  assert.equal(net[V], -242500);
  assert.equal(net[A] + net[V], 0, 'разница курса карты не искажает долг');
});

/* --------------------------------------------------------------- who owes */

test('«кто кому должен»: сумма позиций равна нулю без общей кассы', () => {
  const s = baseState();
  s.expenses = [
    expense({ id: 'e1', amount: 100000, amountHome: 100000 }),
    expense({
      id: 'e2', amount: 70001, amountHome: 70001,
      payers: [{ accountId: 'v_card', personId: V, amount: 70001 }],
      shares: [{ personId: A, amount: 35001 }, { personId: V, amount: 35000 }],
    }),
  ];
  const { net } = netPositions(s);
  assert.equal(net[A] + net[V], 0, 'деньги не появляются и не исчезают');
});

test('«кто кому должен»: одна фраза для двоих, без упрощения долгов', () => {
  const s = baseState();
  s.expenses = [expense({ amount: 864000, amountHome: 864000 })]; // 8 640 ₽ платит Ксюша
  const plan = settlementPlan(s);
  assert.equal(plan.transfers.length, 1);
  assert.deepEqual(plan.transfers[0], { fromPersonId: V, toPersonId: A, amount: 432000 });
  assert.equal(plan.settled, false);
});

test('«кто кому должен»: после расчёта всё сходится в ноль', () => {
  const s = baseState();
  s.expenses = [expense({ amount: 864000, amountHome: 864000 })];
  s.settlements = [{
    id: 's1', date: '2026-09-10', fromPersonId: V, toPersonId: A,
    currency: 'RUB', amount: 432000, rate: '1', amountHome: 432000,
  }];
  const plan = settlementPlan(s);
  assert.equal(plan.settled, true, 'долгов не осталось');
  assert.equal(plan.final[A], 0);
  assert.equal(plan.final[V], 0);
});

test('расчёт в валюте, отличной от валют трат', () => {
  const s = baseState();
  s.expenses = [expense({
    currency: 'AZN', amount: 10000, rate: '48.5', amountHome: 485000,
    payers: [{ accountId: 'a_azn', personId: A, amount: 10000 }],
    shares: [{ personId: A, amount: 5000 }, { personId: V, amount: 5000 }],
  })];
  // Долг посчитан в домашней валюте, а отдать можно наличными AZN.
  s.settlements = [{
    id: 's1', date: '2026-09-10', fromPersonId: V, toPersonId: A,
    currency: 'AZN', amount: 5000, rate: '48.5', amountHome: 242500,
    fromAccountId: 'v_azn', toAccountId: 'a_azn',
  }];
  const plan = settlementPlan(s);
  assert.equal(plan.settled, true);
  const b = accountBalances(s);
  assert.equal(b.v_azn, -5000, 'наличные Вовы ушли');
});

test('перевод между людьми засчитывается как возврат долга', () => {
  const s = baseState();
  s.expenses = [expense({ amount: 100000, amountHome: 100000 })]; // Вова должен 500 ₽
  s.transfers = [{
    id: 't1', date: '2026-09-03', fromAccountId: 'v_card', toAccountId: 'a_card',
    amountOut: 50000, amountIn: 50000, feeAmount: 0,
  }];
  const plan = settlementPlan(s);
  assert.equal(plan.settled, true, 'перевод закрыл долг, даже не будучи «расчётом»');
});

test('обмен валюты между своими счетами на долги не влияет', () => {
  const s = baseState();
  s.expenses = [expense({ amount: 100000, amountHome: 100000 })];
  const before = settlementPlan(s);
  s.transfers = [{
    id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'a_azn',
    amountOut: 2000000, amountIn: 41200, feeAmount: 0,
  }];
  const after = settlementPlan(s);
  assert.deepEqual(after.transfers, before.transfers, 'обменник — не трата и не долг');
});

/* ----------------------------------------------------------- общая касса */

function kittyState() {
  const s = baseState();
  s.accounts.push({
    id: 'kitty', name: 'Общая касса', ownerId: null, kind: ACCOUNT_KINDS.KITTY,
    currency: 'AZN', opening: 0,
  });
  return s;
}

test('общая касса: книги сходятся в ноль, разница курсов видна отдельно', () => {
  const s = kittyState();
  // Оба скинулись по 10 000 ₽ → в кассе 412 AZN.
  s.transfers = [
    { id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'kitty', amountOut: 1000000, amountIn: 20600, feeAmount: 0 },
    { id: 't2', date: '2026-09-01', fromAccountId: 'v_card', toAccountId: 'kitty', amountOut: 1000000, amountIn: 20600, feeAmount: 0 },
  ];
  // Из кассы оплатили ужин на 84,50 AZN.
  s.expenses = [expense({
    currency: 'AZN', amount: 8450, rate: '48.5', amountHome: 409825,
    payers: [{ accountId: 'kitty', personId: null, amount: 8450 }],
    shares: [{ personId: A, amount: 4225 }, { personId: V, amount: 4225 }],
  })];

  const plan = settlementPlan(s);
  // Нераспределённый остаток — это ровно сумма позиций, и делится именно он.
  assert.equal(plan.net[A] + plan.net[V], plan.leftover, 'Σ net = делимый остаток');
  assert.equal(plan.final[A] + plan.final[V], 0, 'книги сходятся в ноль');
  assert.ok(plan.leftover > 0);

  // Физический остаток кассы отличается на разницу курсов — она видна явно,
  // а не размазана по долгам. Обмен шёл по 48,5437, курс поездки 48,5.
  assert.ok(plan.kittyOnHand > 0);
  assert.equal(plan.fxDrift, plan.leftover - plan.kittyOnHand);
  assert.ok(Math.abs(plan.fxDrift) < 5000, `разница курсов мала: ${plan.fxDrift}`);
});

test('общая касса: остаток возвращается по взносам, итог сходится в ноль', () => {
  const s = kittyState();
  s.transfers = [
    { id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'kitty', amountOut: 1500000, amountIn: 30900, feeAmount: 0 },
    { id: 't2', date: '2026-09-01', fromAccountId: 'v_card', toAccountId: 'kitty', amountOut: 500000, amountIn: 10300, feeAmount: 0 },
  ];
  s.expenses = [expense({
    currency: 'AZN', amount: 20000, rate: '48.5', amountHome: 970000,
    payers: [{ accountId: 'kitty', personId: null, amount: 20000 }],
    shares: [{ personId: A, amount: 10000 }, { personId: V, amount: 10000 }],
  })];

  const plan = settlementPlan(s, 'contribution');
  assert.equal(plan.final[A] + plan.final[V], 0, 'после возврата остатка — ноль');
  // Ксюша внесла втрое больше, поэтому ей и возвращается втрое больше остатка.
  assert.ok(plan.refund[A] > plan.refund[V]);
  assert.equal(plan.refund[A] + plan.refund[V], plan.leftover);
  assert.equal(plan.leftover, plan.net[A] + plan.net[V]);
});

test('общая касса: режим «поровну» делит остаток пополам', () => {
  const s = kittyState();
  s.transfers = [
    { id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'kitty', amountOut: 1500000, amountIn: 30900, feeAmount: 0 },
    { id: 't2', date: '2026-09-01', fromAccountId: 'v_card', toAccountId: 'kitty', amountOut: 500000, amountIn: 10300, feeAmount: 0 },
  ];
  const plan = settlementPlan(s, 'equal');
  assert.equal(plan.refund[A] + plan.refund[V], plan.leftover);
  assert.ok(Math.abs(plan.refund[A] - plan.refund[V]) <= 1, 'пополам с точностью до копейки');
  assert.equal(plan.final[A] + plan.final[V], 0);
});

test('общая касса: забрать из кассы себе — взнос уменьшается', () => {
  const s = kittyState();
  s.transfers = [
    { id: 't1', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'kitty', amountOut: 1000000, amountIn: 20600, feeAmount: 0 },
    { id: 't2', date: '2026-09-05', fromAccountId: 'kitty', toAccountId: 'a_azn', amountOut: 10000, amountIn: 10000, feeAmount: 0 },
  ];
  const { kitty } = netPositions(s);
  // Взнос считается по той стороне, что легла в кассу (206 AZN по 48,5 = 9 991 ₽),
  // а не по тому, что списалось с карты (10 000 ₽). Забрали 100 AZN = 4 850 ₽.
  assert.equal(kitty[A], 999100 - 485000, 'взнос минус забранное, по стороне кассы');
  const plan = settlementPlan(s);
  assert.equal(plan.final[A] + plan.final[V], 0);
});

/* -------------------------------------------------------- предоплаты, доли */

test('предоплата до поездки попадает в расчёт', () => {
  const s = baseState();
  s.expenses = [expense({
    id: 'e_flight', date: '2026-08-10', title: 'Перелёт',
    amount: 4000000, amountHome: 4000000,
  })];
  const plan = settlementPlan(s);
  assert.equal(plan.transfers[0].amount, 2000000, 'билеты, купленные дома, делятся так же');
});

test('возврат депозита — отрицательная трата, делится тем же правилом', () => {
  const s = baseState();
  s.expenses = [
    expense({
      id: 'e_dep', title: 'Депозит за отель', amount: 500000, amountHome: 500000,
      payers: [{ accountId: 'a_card', personId: A, amount: 500000 }],
      shares: [{ personId: A, amount: 250000 }, { personId: V, amount: 250000 }],
    }),
    expense({
      id: 'e_ret', title: 'Возврат депозита', amount: -500000, amountHome: -500000,
      shares: [{ personId: A, amount: -250000 }, { personId: V, amount: -250000 }],
      payers: [{ accountId: 'a_card', personId: A, amount: -500000 }],
    }),
  ];
  const plan = settlementPlan(s);
  assert.equal(plan.settled, true, 'депозит вернулся — долга нет');
  assert.equal(accountBalances(s).a_card, 10000000, 'и деньги вернулись на карту');
});

test('несколько плательщиков на одном чеке', () => {
  const s = baseState();
  s.expenses = [expense({
    title: 'Отель', currency: 'RUB', amount: 4000000, amountHome: 4000000,
    payers: [
      { accountId: 'a_card', personId: A, amount: 2500000 },
      { accountId: 'v_card', personId: V, amount: 1500000 },
    ],
    shares: [{ personId: A, amount: 2000000 }, { personId: V, amount: 2000000 }],
  })];
  const plan = settlementPlan(s);
  assert.deepEqual(plan.transfers[0], { fromPersonId: V, toPersonId: A, amount: 500000 });
  const b = accountBalances(s);
  assert.equal(b.a_card, 10000000 - 2500000);
  assert.equal(b.v_card, 10000000 - 1500000);
});

test('личная позиция на общем чеке: вино пил один', () => {
  const people = [{ id: A }, { id: V }];
  const shares = sharesWithPersonalItem(400000, people, V, 120000);
  assert.equal(sum(shares.map((s) => s.amount)), 400000);
  assert.deepEqual(shares, [{ personId: A, amount: 140000 }, { personId: V, amount: 260000 }]);
});

test('buildShares: все режимы дают сумму, равную чеку', () => {
  const people = [{ id: A }, { id: V }];
  const total = 100001;
  const cases = [
    [SPLIT.EQUAL, {}],
    [SPLIT.EQUAL, { excluded: { [V]: true } }],
    [SPLIT.SHARES, { shares: { [A]: 2, [V]: 1 } }],
    [SPLIT.PERCENT, { percent: { [A]: 61.4, [V]: 38.6 } }],
    [SPLIT.EXACT, { exact: { [A]: 60001, [V]: 40000 } }],
  ];
  for (const [mode, input] of cases) {
    const shares = buildShares(mode, total, people, input);
    assert.equal(sum(shares.map((s) => s.amount)), total, `режим ${mode}`);
  }
});

test('buildShares EQUAL с исключением — доля целиком на одного', () => {
  const people = [{ id: A }, { id: V }];
  const shares = buildShares(SPLIT.EQUAL, 100000, people, { excluded: { [V]: true } });
  assert.deepEqual(shares, [{ personId: A, amount: 100000 }, { personId: V, amount: 0 }]);
});

test('homeShares: доли в домашней валюте в сумме дают замороженный итог', () => {
  const e = expense({
    currency: 'AZN', amount: 8450, rate: '48.5', amountHome: 409825,
    shares: [{ personId: A, amount: 4225 }, { personId: V, amount: 4225 }],
  });
  const hs = homeShares(e);
  assert.equal(sum(hs.map((x) => x.amount)), 409825, 'ни копейки мимо');
  const hp = homePayers(e);
  assert.equal(sum(hp.map((x) => x.amountHome)), 409825);
});

/* ------------------------------------------------------------- валидация */

test('validateExpense ловит недобор долей человеческим текстом', () => {
  const s = baseState();
  const e = expense({ shares: [{ personId: A, amount: 30000 }, { personId: V, amount: 50000 }] });
  const errs = validateExpense(e, s);
  assert.ok(errs.some((x) => x.includes('Осталось распределить')), errs.join(' / '));
});

test('validateExpense ловит расхождение плательщиков с чеком', () => {
  const s = baseState();
  const e = expense({ payers: [{ accountId: 'a_card', personId: A, amount: 90000 }] });
  const errs = validateExpense(e, s);
  assert.ok(errs.length > 0);
});

test('validateExpense пропускает корректную трату', () => {
  assert.deepEqual(validateExpense(expense(), baseState()), []);
});

/* -------------------------------------------------------------- итоги */

test('tripTotals: средний расход в день', () => {
  const s = baseState({ trip: { id: 't1', name: 'Баку', homeCurrency: 'RUB', startDate: '2026-09-01', endDate: '2026-09-04' } });
  s.expenses = [
    expense({ id: 'e1', amount: 100000, amountHome: 100000 }),
    expense({ id: 'e2', amount: 300000, amountHome: 300000 }),
  ];
  const t = tripTotals(s);
  assert.equal(t.spent, 400000);
  assert.equal(t.days, 4);
  assert.equal(t.perDay, 100000, '1 000 ₽ в день');
  assert.equal(t.byPerson[A] + t.byPerson[V], 400000);
});

/* ------------------------------------ эталонный сценарий из исследования */

test('ЭТАЛОН: RUB→AZN в обменнике → трата картой партнёра → банкомат с комиссией → итог в RUB', () => {
  const s = baseState();

  // 1. Обменник: Ксюша отдала 20 000 ₽, получила 412 AZN наличными.
  const rate = impliedRate(parseAmount('20000', 'RUB'), 'RUB', parseAmount('412', 'AZN'), 'AZN');
  s.rates.AZN = rate;
  s.transfers.push({
    id: 't_exch', date: '2026-09-01', fromAccountId: 'a_card', toAccountId: 'a_azn',
    amountOut: parseAmount('20000', 'RUB'), amountIn: parseAmount('412', 'AZN'), feeAmount: 0,
    note: 'Обменник у метро',
  });

  // 2. Трата 84,50 AZN картой Вовы (рублёвой), банк списал 4 150 ₽.
  s.expenses.push(expense({
    id: 'e_dinner', title: 'Ужин', currency: 'AZN',
    amount: parseAmount('84,50', 'AZN'), rate, amountHome: 410194,
    payers: [{ accountId: 'v_card', personId: V, amount: 8450, chargedAmount: parseAmount('4150', 'RUB') }],
    shares: [{ personId: A, amount: 4225 }, { personId: V, amount: 4225 }],
  }));

  // 3. Банкомат: Вова снял 100 AZN, со счёта ушло 5 000 ₽ вместе с комиссией.
  s.transfers.push({
    id: 't_atm', date: '2026-09-03', fromAccountId: 'v_card', toAccountId: 'v_azn',
    amountOut: parseAmount('4850', 'RUB'), amountIn: parseAmount('100', 'AZN'),
    feeAmount: parseAmount('150', 'RUB'), note: 'Банкомат Kapital Bank',
  });

  // --- Проверки: всё сошлось без единого костыля.
  const b = accountBalances(s);
  assert.equal(b.a_card, 10000000 - 2000000, 'с карты Ани ушло ровно 20 000 ₽');
  assert.equal(b.a_azn, 41200, 'у Ани 412 AZN наличными');
  assert.equal(b.v_card, 10000000 - 415000 - 485000 - 15000, 'ужин + снятие + комиссия');
  assert.equal(b.v_azn, 10000, 'у Вовы 100 AZN наличными');

  const plan = settlementPlan(s);
  assert.equal(plan.transfers.length, 1);
  assert.equal(plan.transfers[0].fromPersonId, A, 'платил Вова — должна Ксюша');
  assert.equal(plan.transfers[0].toPersonId, V);
  assert.equal(plan.transfers[0].amount, 205097, 'половина ужина по замороженному курсу');
  assert.equal(plan.net[A] + plan.net[V], 0);
  assert.deepEqual(plan.missingRates, [], 'курсов хватило, сеть не понадобилась');
});
