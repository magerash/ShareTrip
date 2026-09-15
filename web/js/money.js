// money.js — все деньги здесь. Целые минорные единицы, BigInt для курсов,
// детерминированное распределение остатка. Ни одного float в хранимых данных.
//
// Договорённости (D-001, D-002):
//   * сумма = целое число минорных единиц (копеек/центов) + код валюты;
//   * курс = строка-десятичная дробь, "сколько ДОМАШНЕЙ валюты за 1 единицу валюты траты";
//   * конвертация замораживается в момент операции и хранится рядом с оригиналом.

/** Число знаков после запятой у валюты. Всё, чего нет в таблице, — два знака. */
const DECIMALS = {
  JPY: 0, KRW: 0, VND: 0, IDR: 0, CLP: 0, ISK: 0, HUF: 0, TWD: 0, UGX: 0, PYG: 0,
  BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3,
};

export function decimalsOf(code) {
  return Object.prototype.hasOwnProperty.call(DECIMALS, code) ? DECIMALS[code] : 2;
}

const POW10 = [];
for (let i = 0; i <= 30; i += 1) POW10.push(10n ** BigInt(i));
function pow10(n) {
  if (n < 0) throw new RangeError('pow10: отрицательная степень');
  return n < POW10.length ? POW10[n] : 10n ** BigInt(n);
}

/* ------------------------------------------------------------------ parsing */

/**
 * Разбирает введённую человеком сумму в минорные единицы.
 * Принимает "1 234,56", "1234.56", "1.234,56" (европейский формат), "-40".
 * Возвращает целое число минорных единиц или null, если строка не сумма.
 */
export function parseAmount(input, code) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    input = String(input);
  }
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/\s| |'|_/g, '');
  if (!s) return null;

  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);

  // Оба разделителя сразу: последний из них — десятичный, остальное — разряды.
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const sep = lastDot > lastComma ? '.' : ',';
    const other = sep === '.' ? ',' : '.';
    s = s.split(other).join('');
    s = s.replace(sep, '.');
  } else if (lastComma >= 0) {
    // Одна запятая. "1,234" неоднозначно — трактуем как десятичную дробь,
    // потому что в поле ввода траты человек пишет "1,5", а не разряды.
    s = s.replace(',', '.');
  }

  if (!/^\d*(\.\d*)?$/.test(s) || s === '.' || s === '') return null;

  const dec = decimalsOf(code);
  let [whole, frac = ''] = s.split('.');
  whole = whole || '0';
  if (frac.length > dec) {
    // Лишние знаки — округляем половину вверх, а не отбрасываем.
    const keep = frac.slice(0, dec);
    const next = frac.charCodeAt(dec) - 48;
    let v = BigInt(whole + (keep || '')) ;
    if (next >= 5) v += 1n;
    return Number(neg ? -v : v);
  }
  frac = frac.padEnd(dec, '0');
  const v = BigInt(whole + frac);
  return Number(neg ? -v : v);
}

/* --------------------------------------------------------------- formatting */

/** Минорные единицы → строка "1 234,56" (без кода валюты). */
export function formatAmount(minor, code, opts = {}) {
  const dec = decimalsOf(code);
  const neg = minor < 0;
  const abs = BigInt(Math.abs(Math.round(minor)));
  const d = pow10(dec);
  const whole = (abs / d).toString();
  const frac = dec ? (abs % d).toString().padStart(dec, '0') : '';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  let out = dec && !opts.noFraction ? `${grouped},${frac}` : grouped;
  if (neg) out = `−${out}`;
  return out;
}

/** То же плюс символ валюты: "1 234,56 ₽". */
export function formatMoney(minor, code, opts = {}) {
  return `${formatAmount(minor, code, opts)} ${symbolOf(code)}`;
}

const SYMBOLS = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
  AZN: '₼', GEL: '₾', TRY: '₺', KZT: '₸', UAH: '₴',
  AMD: '֏', THB: '฿', VND: '₫', INR: '₹', KRW: '₩',
  CNY: '¥', PLN: 'zł', RSD: 'din', AED: 'AED', UZS: 'soʼm',
};
export function symbolOf(code) { return SYMBOLS[code] || code; }

/* -------------------------------------------------------------------- rates */

/** Строка-курс → {num: BigInt, scale: number}. "48,5" → {num:485n, scale:1}. */
export function parseRate(input) {
  if (typeof input === 'number') input = String(input);
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/\s| /g, '').replace(',', '.');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.' || s === '') return null;
  const [whole = '0', frac = ''] = s.split('.');
  const num = BigInt((whole || '0') + frac);
  if (num <= 0n) return null;
  return { num, scale: frac.length };
}

export function isValidRate(input) { return parseRate(input) !== null; }

/** Нормализует курс к компактной строке без хвостовых нулей. */
export function normalizeRate(input) {
  const r = parseRate(input);
  if (!r) return null;
  let s = r.num.toString().padStart(r.scale + 1, '0');
  if (r.scale === 0) return s;
  let out = `${s.slice(0, s.length - r.scale)}.${s.slice(s.length - r.scale)}`;
  out = out.replace(/0+$/, '').replace(/\.$/, '');
  return out;
}

/** Курс для показа человеку: "1 AZN = 48,5 ₽". */
export function formatRate(rate, from, to) {
  const n = normalizeRate(rate);
  if (!n) return '';
  return `1 ${from} = ${n.replace('.', ',')} ${symbolOf(to)}`;
}

/** Делит два целых с округлением половины вверх (по модулю). */
function divRound(num, den) {
  if (den === 0n) throw new RangeError('divRound: деление на ноль');
  const neg = (num < 0n) !== (den < 0n);
  const a = num < 0n ? -num : num;
  const b = den < 0n ? -den : den;
  const q = (a * 2n + b) / (b * 2n);
  return neg ? -q : q;
}

/**
 * Конвертация с замороженным курсом.
 * @param {number} minor сумма в минорных единицах валюты `from`
 * @param {string} from  код валюты суммы
 * @param {string} rate  строка-курс: сколько `to` за 1 `from`
 * @param {string} to    домашняя валюта
 * @returns {number} минорные единицы валюты `to`
 */
export function convert(minor, from, rate, to) {
  const r = parseRate(rate);
  if (!r) throw new TypeError(`convert: некорректный курс ${JSON.stringify(rate)}`);
  if (from === to && normalizeRate(rate) === '1') return Math.round(minor);
  const dFrom = decimalsOf(from);
  const dTo = decimalsOf(to);
  const num = BigInt(Math.round(minor)) * r.num * pow10(dTo);
  const den = pow10(r.scale) * pow10(dFrom);
  return Number(divRound(num, den));
}

/**
 * Обратная задача: по «ушло» и «пришло» вывести фактический курс.
 * Это курс обменника/банкомата — тот самый, которого «никто не даёт».
 * @returns {string|null} курс: сколько `outCode` за 1 `inCode`
 */
export function impliedRate(outMinor, outCode, inMinor, inCode, precision = 6) {
  if (!inMinor || !outMinor) return null;
  const dOut = decimalsOf(outCode);
  const dIn = decimalsOf(inCode);
  const num = BigInt(Math.abs(Math.round(outMinor))) * pow10(dIn) * pow10(precision);
  const den = BigInt(Math.abs(Math.round(inMinor))) * pow10(dOut);
  const scaled = divRound(num, den);
  let s = scaled.toString().padStart(precision + 1, '0');
  let out = `${s.slice(0, s.length - precision)}.${s.slice(s.length - precision)}`;
  out = out.replace(/0+$/, '').replace(/\.$/, '');
  return out === '' || out === '0' ? null : out;
}

/* ------------------------------------------------------------------ splitting */

/**
 * Детерминированное распределение суммы по весам — метод наибольшего остатка.
 * Сумма результата ВСЕГДА равна `total`. Остаток отдаётся долям с наибольшей
 * дробной частью; при равенстве — меньшему индексу. Никакой случайности
 * (это и есть жалоба на Splitwise, который «раскидывает копейки случайно»).
 *
 * @param {number} total целое, может быть отрицательным (возврат депозита)
 * @param {number[]} weights неотрицательные веса
 * @returns {number[]} целые, сумма которых равна total
 */
export function allocate(total, weights) {
  const n = weights.length;
  if (n === 0) return [];
  if (weights.some((w) => !(Number.isFinite(w) && w >= 0))) {
    throw new RangeError('allocate: вес должен быть неотрицательным числом');
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // Все веса нулевые — делим поровну, иначе деньги провалятся в никуда.
    return allocate(total, new Array(n).fill(1));
  }

  const neg = total < 0;
  const T = Math.abs(Math.round(total));

  // Масштабируем веса в целые, чтобы работать в BigInt.
  const SCALE = 1e6;
  const wInt = weights.map((w) => BigInt(Math.round(w * SCALE)));
  let wSum = wInt.reduce((a, b) => a + b, 0n);
  if (wSum === 0n) return allocate(total, new Array(n).fill(1));

  const Tb = BigInt(T);
  const base = [];
  const rema = [];
  let given = 0n;
  for (let i = 0; i < n; i += 1) {
    const num = Tb * wInt[i];
    const q = num / wSum;
    base.push(q);
    rema.push(num - q * wSum);
    given += q;
  }
  let left = Tb - given;

  const order = rema
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : (b.r > a.r ? 1 : -1)));

  let k = 0;
  while (left > 0n && order.length) {
    base[order[k % order.length].i] += 1n;
    left -= 1n;
    k += 1;
  }

  return base.map((v) => Number(neg ? -v : v));
}

/** Поровну между n участниками — частный случай allocate. */
export function splitEqual(total, n) {
  return allocate(total, new Array(n).fill(1));
}

/**
 * Сколько ещё не распределено при вводе точных сумм.
 * Именно это число показывается под формой: «осталось распределить: X».
 */
export function remainder(total, parts) {
  const given = parts.reduce((a, b) => a + (b || 0), 0);
  return Math.round(total) - Math.round(given);
}

/** Сумма массива минорных единиц. */
export function sum(list) {
  return list.reduce((a, b) => a + (b || 0), 0);
}
