// store.js — единственное изменяемое состояние приложения.
// Мутации проходят только здесь: каждая пишет строку в журнал и сразу
// сохраняет документ. Экраны на состояние подписываются, а не лезут в базу.

import * as db from './db.js';
import { newId, todayISO, ACCOUNT_KINDS } from './model.js';
import { convert, normalizeRate } from './money.js';

const listeners = new Set();
let state = null;
let saveError = null;

export const DEFAULT_CATEGORIES = [
  { id: 'c_food', name: 'Еда', icon: '🍽' },
  { id: 'c_stay', name: 'Жильё', icon: '🏨' },
  { id: 'c_move', name: 'Транспорт', icon: '🚕' },
  { id: 'c_fun', name: 'Развлечения', icon: '🎟' },
  { id: 'c_shop', name: 'Покупки', icon: '🛍' },
  { id: 'c_health', name: 'Здоровье', icon: '💊' },
  { id: 'c_fees', name: 'Комиссии', icon: '🏦' },
  { id: 'c_other', name: 'Прочее', icon: '•' },
];

/* ------------------------------------------------------------ подписка */

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error('Ошибка перерисовки', err); }
  }
}

export function getState() { return state; }
export function getSaveError() { return saveError; }

/* ------------------------------------------------------------ сохранение */

// Пишем СРАЗУ, без задержки (D-008). Документ маленький, запись дешёвая, а
// отложенное сохранение теряло последнюю операцию, если страницу перезагружали
// в окне задержки: `pagehide` не успевает дождаться асинхронной транзакции
// IndexedDB. Для приложения, куда вбивают трату и сразу гасят планшет, это
// означало бы «добавил и пропало».
let saving = false;
let dirty = false;

function scheduleSave(op) {
  if (op) {
    db.appendJournal({ tripId: state?.id, ...op }).catch(() => { /* журнал не критичен */ });
  }
  persist();
}

async function persist() {
  if (!state) return;
  if (saving) { dirty = true; return; }
  saving = true;
  try {
    await db.putTrip(state);
    if (saveError) { saveError = null; notify(); }
  } catch (err) {
    saveError = err;
    console.error('Не удалось сохранить', err);
    notify();
  } finally {
    saving = false;
    if (dirty) { dirty = false; persist(); }
  }
}

/** Дописать состояние на диск и дождаться конца записи. */
export async function flush() {
  dirty = false;
  await persist();
}

function mutate(op, fn) {
  fn(state);
  scheduleSave(op);
  notify();
}

/* ------------------------------------------------------------- создание */

export function blankTrip({ name, homeCurrency, people, startDate, endDate }) {
  const id = newId('trip');
  const persons = people.map((n, i) => ({
    id: newId('p'), name: n, color: i === 0 ? 'teal' : 'sky',
  }));
  return {
    id,
    schema: 1,
    createdAt: new Date().toISOString(),
    trip: {
      id,
      name,
      homeCurrency,
      startDate: startDate || todayISO(),
      endDate: endDate || '',
      dailyBudget: 0,
    },
    people: persons,
    accounts: persons.flatMap((p) => ([
      {
        id: newId('a'), name: `Карта · ${p.name}`, ownerId: p.id,
        kind: ACCOUNT_KINDS.CARD, currency: homeCurrency, opening: 0,
      },
    ])),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    expenses: [],
    transfers: [],
    settlements: [],
    rates: {},
    settings: { kittyMode: 'contribution' },
  };
}

export async function createTrip(opts) {
  const doc = blankTrip(opts);
  state = doc;
  await db.putTrip(doc);
  await db.setMeta('lastTripId', doc.id);
  notify();
  return doc;
}

export async function loadTrip(id) {
  const doc = await db.getTrip(id);
  if (!doc) throw new Error('Поездка не найдена');
  state = migrate(doc);
  await db.setMeta('lastTripId', id);
  notify();
  return state;
}

export async function loadLast() {
  const id = await db.getMeta('lastTripId');
  const trips = await db.listTrips();
  if (!trips.length) return null;
  const pick = (id && trips.find((t) => t.id === id)) || trips[0];
  state = migrate(pick);
  await db.setMeta('lastTripId', pick.id);
  notify();
  return state;
}

/** Мягкая миграция старых документов: недостающие поля добавляются, ничего не теряется. */
function migrate(doc) {
  const d = { ...doc };
  d.schema = d.schema || 1;
  d.people = d.people || [];
  d.accounts = d.accounts || [];
  d.categories = d.categories?.length ? d.categories : DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  d.expenses = d.expenses || [];
  d.transfers = d.transfers || [];
  d.settlements = d.settlements || [];
  d.rates = d.rates || {};
  d.settings = { kittyMode: 'contribution', ...(d.settings || {}) };
  d.trip = { dailyBudget: 0, ...d.trip };
  return d;
}

export { db };

/* ------------------------------------------------------------- мутации */

export function setTripField(patch) {
  mutate({ op: 'trip.update', patch }, (s) => { s.trip = { ...s.trip, ...patch }; });
}

export function setSetting(patch) {
  mutate({ op: 'settings.update', patch }, (s) => { s.settings = { ...s.settings, ...patch }; });
}

/** Курс валюты к домашней. Хранится как нормализованная строка. */
export function setRate(code, rate) {
  const norm = normalizeRate(rate);
  mutate({ op: 'rate.set', code, rate: norm }, (s) => {
    if (norm) s.rates[code] = norm;
    else delete s.rates[code];
  });
}

export function addPerson(name) {
  const p = { id: newId('p'), name, color: 'sky' };
  mutate({ op: 'person.add', id: p.id, name }, (s) => { s.people.push(p); });
  return p;
}

export function updatePerson(id, patch) {
  mutate({ op: 'person.update', id, patch }, (s) => {
    const p = s.people.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
}

export function addAccount(acc) {
  const a = { id: newId('a'), opening: 0, ...acc };
  mutate({ op: 'account.add', id: a.id, name: a.name }, (s) => { s.accounts.push(a); });
  return a;
}

export function updateAccount(id, patch) {
  mutate({ op: 'account.update', id, patch }, (s) => {
    const a = s.accounts.find((x) => x.id === id);
    if (a) Object.assign(a, patch);
  });
}

export function deleteAccount(id) {
  mutate({ op: 'account.delete', id }, (s) => {
    const a = s.accounts.find((x) => x.id === id);
    if (a) a.deleted = true;
  });
}

export function addCategory(name, icon) {
  const c = { id: newId('c'), name, icon: icon || '•' };
  mutate({ op: 'category.add', id: c.id, name }, (s) => { s.categories.push(c); });
  return c;
}

export function deleteCategory(id) {
  mutate({ op: 'category.delete', id }, (s) => {
    const c = s.categories.find((x) => x.id === id);
    if (c) c.deleted = true;
  });
}

/* --------------------------------------------------------------- траты */

export function addExpense(e) {
  const rec = { id: newId('e'), createdAt: new Date().toISOString(), ...e };
  mutate({ op: 'expense.add', id: rec.id, title: rec.title, amount: rec.amount, currency: rec.currency },
    (s) => { s.expenses.push(rec); });
  return rec;
}

export function updateExpense(id, patch) {
  mutate({ op: 'expense.update', id, patch }, (s) => {
    const e = s.expenses.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  });
}

export function deleteExpense(id) {
  mutate({ op: 'expense.delete', id }, (s) => {
    const e = s.expenses.find((x) => x.id === id);
    if (e) e.deleted = true;
  });
}

export function restoreExpense(id) {
  mutate({ op: 'expense.restore', id }, (s) => {
    const e = s.expenses.find((x) => x.id === id);
    if (e) delete e.deleted;
  });
}

/* ------------------------------------------------------------ переводы */

export function addTransfer(t) {
  const rec = { id: newId('t'), createdAt: new Date().toISOString(), ...t };
  mutate({ op: 'transfer.add', id: rec.id, out: rec.amountOut, in: rec.amountIn },
    (s) => { s.transfers.push(rec); });
  return rec;
}

export function updateTransfer(id, patch) {
  mutate({ op: 'transfer.update', id, patch }, (s) => {
    const t = s.transfers.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  });
}

export function deleteTransfer(id) {
  mutate({ op: 'transfer.delete', id }, (s) => {
    const t = s.transfers.find((x) => x.id === id);
    if (t) t.deleted = true;
  });
}

/* ------------------------------------------------------------- расчёты */

export function addSettlement(s0) {
  const rec = { id: newId('s'), createdAt: new Date().toISOString(), ...s0 };
  mutate({ op: 'settlement.add', id: rec.id, amount: rec.amount }, (s) => {
    s.settlements.push(rec);
  });
  return rec;
}

export function deleteSettlement(id) {
  mutate({ op: 'settlement.delete', id }, (s) => {
    const r = s.settlements.find((x) => x.id === id);
    if (r) r.deleted = true;
  });
}

/* --------------------------------------------------------------- прочее */

/** Валюты, которые реально используются в поездке. */
export function usedCurrencies(s = state) {
  const set = new Set([s.trip.homeCurrency]);
  for (const a of s.accounts) if (!a.deleted) set.add(a.currency);
  for (const e of s.expenses) if (!e.deleted) set.add(e.currency);
  return [...set];
}

/** Домашняя стоимость суммы по курсу поездки; null, если курса нет. */
export function homeValue(minor, code, s = state) {
  if (code === s.trip.homeCurrency) return minor;
  const r = s.rates[code];
  return r ? convert(minor, code, r, s.trip.homeCurrency) : null;
}

export async function importDump(dump, opts) {
  const n = await db.importAll(dump, opts);
  const loaded = await loadLast();
  return { count: n, loaded };
}
