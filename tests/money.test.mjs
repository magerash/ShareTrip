// Тесты денежного ядра. Запуск: node --test tests/
// Каждый кейс здесь — либо жалоба пользователя из исследования, либо
// пограничный случай из docs/specs/money.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount, formatAmount, formatMoney, decimalsOf,
  parseRate, normalizeRate, convert, impliedRate,
  allocate, splitEqual, remainder, sum,
} from '../web/js/money.js';

test('parseAmount: форматы, которые реально набирают пальцем', () => {
  assert.equal(parseAmount('100', 'RUB'), 10000);
  assert.equal(parseAmount('100,50', 'RUB'), 10050);
  assert.equal(parseAmount('100.50', 'RUB'), 10050);
  assert.equal(parseAmount('1 234,56', 'RUB'), 123456);
  assert.equal(parseAmount('1 234,56', 'RUB'), 123456);
  assert.equal(parseAmount('1.234,56', 'RUB'), 123456, 'европейские разряды');
  assert.equal(parseAmount('1,234.56', 'RUB'), 123456, 'английские разряды');
  assert.equal(parseAmount('1,5', 'RUB'), 150, 'одна запятая — дробь, не разряды');
  assert.equal(parseAmount('-40', 'RUB'), -4000, 'возврат депозита');
  assert.equal(parseAmount('  12  ', 'RUB'), 1200);
  assert.equal(parseAmount(',5', 'RUB'), 50);
});

test('parseAmount: валюты без копеек и с тремя знаками', () => {
  assert.equal(decimalsOf('VND'), 0);
  assert.equal(parseAmount('85000', 'VND'), 85000, 'обед во Вьетнаме');
  assert.equal(parseAmount('85000,4', 'VND'), 85000, 'дробь отбрасывается вниз');
  assert.equal(parseAmount('85000,6', 'VND'), 85001, 'половина — вверх');
  assert.equal(decimalsOf('KWD'), 3);
  assert.equal(parseAmount('1,234', 'KWD'), 1234);
});

test('parseAmount: мусор отклоняется, а не превращается в ноль', () => {
  for (const bad of ['', '  ', 'abc', '1,2,3.4.5', '.', '-', '12 руб', '1e5']) {
    assert.equal(parseAmount(bad, 'RUB'), null, `«${bad}» должно быть null`);
  }
});

test('formatAmount: разряды, знак минус, валюты без дроби', () => {
  assert.equal(formatAmount(123456, 'RUB'), '1 234,56');
  assert.equal(formatAmount(0, 'RUB'), '0,00');
  assert.equal(formatAmount(-4320_00, 'RUB'), '−4 320,00');
  assert.equal(formatAmount(85000, 'VND'), '85 000');
  assert.equal(formatMoney(432000, 'RUB'), '4 320,00 ₽');
});

test('formatAmount(parseAmount(x)) — круговой прогон не теряет копейки', () => {
  for (const s of ['0,01', '999,99', '1 000 000,00', '7,07']) {
    const m = parseAmount(s, 'RUB');
    assert.equal(formatAmount(m, 'RUB').replace(/ /g, ' '), s, s);
  }
});

test('parseRate / normalizeRate', () => {
  assert.equal(normalizeRate('48,5'), '48.5');
  assert.equal(normalizeRate('48.500'), '48.5', 'хвостовые нули срезаются');
  assert.equal(normalizeRate('1'), '1');
  assert.equal(normalizeRate('0,0125'), '0.0125');
  assert.equal(parseRate('0'), null, 'нулевой курс — не курс');
  assert.equal(parseRate('-2'), null);
  assert.equal(parseRate('абв'), null);
});

test('convert: курс заморожен и считается без float', () => {
  // 100,00 AZN по 48,5 ₽ = 4850,00 ₽
  assert.equal(convert(10000, 'AZN', '48.5', 'RUB'), 485000);
  // тождественный курс не трогает сумму
  assert.equal(convert(12345, 'RUB', '1', 'RUB'), 12345);
  // разная разрядность: 85 000 VND по 0,00335 ₽ = 284,75 ₽
  assert.equal(convert(85000, 'VND', '0.00335', 'RUB'), 28475);
  // в валюту без дроби: 1000,00 RUB по 0,0299 ₫... → 29,9 → 30 VND
  assert.equal(convert(100000, 'RUB', '0.0299', 'VND'), 30);
  // ровно половина минорной единицы округляется вверх, а не «к чётному»:
  // 0,01 AZN × 0,5 = 0,005 ₽ = ровно полкопейки → 1 копейка
  assert.equal(convert(1, 'AZN', '0.5', 'RUB'), 1);
  // а меньше половины — вниз, без «подарков»
  assert.equal(convert(1, 'AZN', '0.4', 'RUB'), 0);
});

test('convert: классическая ошибка float здесь не воспроизводится', () => {
  // 0.1 + 0.2 !== 0.3 в float; на целых — точно.
  const a = convert(1010, 'USD', '90.15', 'RUB'); // 10,10 USD
  assert.equal(a, 91052); // 910,515 → 910,52 ₽
  assert.equal(typeof a, 'number');
  assert.ok(Number.isInteger(a));
});

test('impliedRate: курс обменника выводится из «ушло / пришло»', () => {
  // Отдали 10 000 ₽, получили 206 AZN → 1 AZN = 48,543689 ₽
  const r = impliedRate(1000000, 'RUB', 20600, 'AZN');
  assert.equal(r, '48.543689');
  // И обратная проверка: конвертация по этому курсу возвращает исходное.
  assert.equal(convert(20600, 'AZN', r, 'RUB'), 1000000);
});

test('impliedRate: банкомат с комиссией — курс включает комиссию', () => {
  // Со счёта ушло 9 350 ₽ (100 USD + комиссия), на руки 100 USD.
  const r = impliedRate(935000, 'RUB', 10000, 'USD');
  assert.equal(r, '93.5');
  assert.equal(convert(10000, 'USD', r, 'RUB'), 935000, 'без потерь');
});

test('impliedRate: ноль не ломает и не делит на ноль', () => {
  assert.equal(impliedRate(0, 'RUB', 100, 'AZN'), null);
  assert.equal(impliedRate(100, 'RUB', 0, 'AZN'), null);
});

test('allocate: сумма долей ВСЕГДА равна целому', () => {
  const cases = [
    [10000, [1, 1]], [10001, [1, 1]], [1, [1, 1]], [0, [1, 1]],
    [100, [1, 2]], [1000, [1, 1, 1]], [10, [3, 3, 3]],
    [999999, [61.4, 38.6]], [7, [1, 1, 1, 1, 1, 1]],
  ];
  for (const [total, w] of cases) {
    const parts = allocate(total, w);
    assert.equal(sum(parts), total, `${total} по ${JSON.stringify(w)} → ${JSON.stringify(parts)}`);
  }
});

test('allocate: детерминированность — тот же вход даёт тот же выход', () => {
  const a = allocate(10001, [1, 1]);
  for (let i = 0; i < 50; i += 1) {
    assert.deepEqual(allocate(10001, [1, 1]), a, 'никакой случайности (в отличие от Splitwise)');
  }
  assert.deepEqual(a, [5001, 5000], 'лишняя копейка — первому, а не случайному');
});

test('allocate: отрицательный итог (возврат депозита) делится так же', () => {
  const parts = allocate(-10001, [1, 1]);
  assert.equal(sum(parts), -10001);
  assert.deepEqual(parts, [-5001, -5000]);
});

test('allocate: дробные доли 61,40 / 38,60 — ужин, где вино пил один', () => {
  const parts = allocate(40000, [61.4, 38.6]);
  assert.deepEqual(parts, [24560, 15440]);
  assert.equal(sum(parts), 40000);
});

test('allocate: нулевые веса не топят деньги', () => {
  assert.equal(sum(allocate(10000, [0, 0])), 10000);
  assert.deepEqual(allocate(10000, [1, 0]), [10000, 0], 'личная позиция целиком на одного');
});

test('allocate: отрицательный вес — это ошибка ввода, а не тихий ноль', () => {
  assert.throws(() => allocate(100, [1, -1]), RangeError);
  assert.throws(() => allocate(100, [1, NaN]), RangeError);
});

test('splitEqual: 100,01 ₽ на двоих', () => {
  assert.deepEqual(splitEqual(10001, 2), [5001, 5000]);
  assert.equal(sum(splitEqual(10001, 3)), 10001);
});

test('remainder: «осталось распределить» — знаковое число', () => {
  assert.equal(remainder(40000, [24560, 15440]), 0);
  assert.equal(remainder(40000, [20000]), 20000, 'недобор');
  assert.equal(remainder(40000, [30000, 20000]), -10000, 'перебор');
});

test('сценарий из docs/specs/money.md: отель на две карты, 400 EUR', () => {
  // Жалоба Dexter #540: «250 заплатил ты, 150 — она, но плательщик только один».
  const total = parseAmount('400', 'EUR');
  const payers = [parseAmount('250', 'EUR'), parseAmount('150', 'EUR')];
  assert.equal(sum(payers), total, 'сумма плательщиков равна итогу');
  const shares = splitEqual(total, 2);
  assert.deepEqual(shares, [20000, 20000]);
  // Чистая позиция: заплатил минус доля.
  const net = payers.map((p, i) => p - shares[i]);
  assert.deepEqual(net, [5000, -5000], 'партнёр должен 50 EUR');
  assert.equal(sum(net), 0, 'ноль суммарно — деньги не появляются из воздуха');
});

test('сценарий: RUB→AZN в обменнике → трата в AZN → итог в RUB', () => {
  // 1. Обменник: отдали 20 000 ₽, получили 412 AZN.
  const out = parseAmount('20000', 'RUB');
  const got = parseAmount('412', 'AZN');
  const rate = impliedRate(out, 'RUB', got, 'AZN');
  assert.equal(rate, '48.543689');

  // 2. Ужин 84,50 AZN, платит партнёр, делим поровну, курс заморожен.
  const dinner = parseAmount('84,50', 'AZN');
  const dinnerHome = convert(dinner, 'AZN', rate, 'RUB');
  assert.equal(dinnerHome, 410194); // 4101,94 ₽
  const shares = splitEqual(dinnerHome, 2);
  assert.equal(sum(shares), dinnerHome, 'копейка не потерялась');
  assert.deepEqual(shares, [205097, 205097]);

  // 3. Курс завтра поехал — замороженное значение не меняется.
  const tomorrow = '52.0';
  assert.notEqual(convert(dinner, 'AZN', tomorrow, 'RUB'), dinnerHome);
  assert.equal(dinnerHome, 410194, 'баланс не «поехал» задним числом');
});
