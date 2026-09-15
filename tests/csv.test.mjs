// Тесты выгрузки CSV. Проверяем то, что ломается в реальных таблицах:
// разделитель, экранирование, десятичная запятая, кириллица, сходимость сумм.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expensesCSV, transfersCSV, accountsCSV, settlementCSV, fullCSV } from '../web/js/csv.js';
import { SPLIT, ACCOUNT_KINDS } from '../web/js/model.js';

const A = 'p_a';
const V = 'p_v';

function state() {
  return {
    trip: { id: 't', name: 'Баку', homeCurrency: 'RUB', startDate: '2026-09-01', endDate: '2026-09-05' },
    people: [{ id: A, name: 'Ксюша' }, { id: V, name: 'Вова' }],
    accounts: [
      { id: 'a1', name: 'Карта Ксюши', ownerId: A, kind: ACCOUNT_KINDS.CARD, currency: 'RUB', opening: 1000000 },
      { id: 'v1', name: 'Карта Вовы', ownerId: V, kind: ACCOUNT_KINDS.CARD, currency: 'RUB', opening: 1000000 },
      { id: 'k1', name: 'Общая касса', ownerId: null, kind: ACCOUNT_KINDS.KITTY, currency: 'AZN', opening: 0 },
    ],
    categories: [{ id: 'c1', name: 'Еда' }, { id: 'c2', name: 'Транспорт; такси' }],
    expenses: [
      {
        id: 'e1', date: '2026-09-02', title: 'Ужин "У Гагика"', categoryId: 'c1',
        currency: 'AZN', amount: 8450, rate: '48.543689', amountHome: 410194,
        payers: [{ accountId: 'v1', personId: V, amount: 8450 }],
        shares: [{ personId: A, amount: 4225 }, { personId: V, amount: 4225 }],
        splitMode: SPLIT.EQUAL, note: 'вино\nотдельно',
      },
      {
        id: 'e2', date: '2026-09-03', title: 'Такси', categoryId: 'c2',
        currency: 'RUB', amount: 70001, rate: '1', amountHome: 70001,
        payers: [{ accountId: 'a1', personId: A, amount: 70001 }],
        shares: [{ personId: A, amount: 35001 }, { personId: V, amount: 35000 }],
        splitMode: SPLIT.EXACT, note: '',
      },
    ],
    transfers: [{
      id: 't1', date: '2026-09-01', fromAccountId: 'a1', toAccountId: 'k1',
      amountOut: 1000000, amountIn: 20600, feeAmount: 15000,
      rate: '48.543689', note: 'Обменник',
    }],
    settlements: [],
    rates: { AZN: '48.543689' },
    settings: { kittyMode: 'contribution' },
  };
}

function parse(csv) {
  return csv.split('\r\n').map((line) => {
    const cells = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ';') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

test('CSV трат: заголовок и число строк', () => {
  const rows = parse(expensesCSV(state()));
  assert.equal(rows.length, 3, 'шапка + две траты');
  assert.equal(rows[0][0], 'Дата');
  assert.ok(rows[0].includes('Сумма, RUB'));
  assert.ok(rows[0].includes('Доля: Ксюша, RUB'));
});

test('CSV трат: точка с запятой внутри поля экранируется, а не рвёт строку', () => {
  const rows = parse(expensesCSV(state()));
  const taxi = rows.find((r) => r[1] === 'Такси');
  assert.equal(taxi[2], 'Транспорт; такси', 'категория с точкой с запятой уцелела');
  assert.equal(taxi.length, rows[0].length, 'колонок столько же, сколько в шапке');
});

test('CSV трат: кавычки и перенос строки внутри поля', () => {
  const rows = parse(expensesCSV(state()));
  const dinner = rows.find((r) => r[1].startsWith('Ужин'));
  assert.equal(dinner[1], 'Ужин "У Гагика"', 'двойные кавычки восстановились');
  assert.ok(dinner[dinner.length - 1].includes('вино'), 'заметка на месте');
});

test('CSV трат: десятичная запятая и замороженный курс', () => {
  const rows = parse(expensesCSV(state()));
  const dinner = rows.find((r) => r[1].startsWith('Ужин'));
  assert.equal(dinner[3], 'AZN');
  assert.equal(dinner[4], '84,50', 'сумма в валюте траты');
  assert.equal(dinner[5], '48.543689', 'курс — как хранится, без подмены');
  assert.equal(dinner[6], '4101,94', 'пересчёт в домашнюю валюту');
});

test('CSV трат: доли в сумме дают итог траты', () => {
  const rows = parse(expensesCSV(state()));
  const head = rows[0];
  const iA = head.indexOf('Доля: Ксюша, RUB');
  const iV = head.indexOf('Доля: Вова, RUB');
  for (const r of rows.slice(1)) {
    const total = Number(r[6].replace(',', '.'));
    const sum = Number(r[iA].replace(',', '.')) + Number(r[iV].replace(',', '.'));
    assert.ok(Math.abs(total - sum) < 0.005, `${r[1]}: ${total} vs ${sum}`);
  }
});

test('CSV переводов: комиссия и фактический курс отдельными колонками', () => {
  const rows = parse(transfersCSV(state()));
  assert.equal(rows.length, 2);
  const t = rows[1];
  assert.equal(t[1], 'Карта Ксюши');
  assert.equal(t[2], 'Общая касса');
  assert.equal(t[4], '10000,00', 'ушло рублей');
  assert.equal(t[6], '206,00', 'пришло манатов');
  assert.equal(t[7], '150,00', 'комиссия');
  assert.equal(t[8], '48.543689');
});

test('CSV счетов: остаток совпадает с расчётом модели', () => {
  const rows = parse(accountsCSV(state()));
  const kitty = rows.find((r) => r[0] === 'Общая касса');
  assert.equal(kitty[1], 'общий');
  assert.equal(kitty[2], 'общая касса');
  assert.equal(kitty[5], '206,00', 'в кассе 206 манатов');

  const anya = rows.find((r) => r[0] === 'Карта Ксюши');
  // 10 000 начальных − 700,01 такси − 10 000 перевод − 150 комиссия
  assert.equal(anya[5], '-850,01');
});

test('CSV расчёта: строки участников и итог сходятся в ноль', () => {
  const rows = parse(settlementCSV(state(), 'contribution'));
  const anya = rows.find((r) => r[0] === 'Ксюша');
  const vova = rows.find((r) => r[0] === 'Вова');
  const fin = (r) => Number(r[6].replace(',', '.'));
  assert.ok(Math.abs(fin(anya) + fin(vova)) < 0.005, 'итоги гасят друг друга');
});

test('fullCSV: все четыре листа на месте', () => {
  const text = fullCSV(state(), 'contribution');
  for (const marker of ['## ТРАТЫ', '## ПЕРЕВОДЫ', '## СЧЕТА', '## РАСЧЁТ', '# ShareTrip — Баку']) {
    assert.ok(text.includes(marker), marker);
  }
});

test('CSV: пустая поездка не падает', () => {
  const s = state();
  s.expenses = []; s.transfers = []; s.settlements = [];
  assert.doesNotThrow(() => fullCSV(s, 'contribution'));
  assert.equal(parse(expensesCSV(s)).length, 1, 'только шапка');
});
