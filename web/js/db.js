// db.js — хранилище. IndexedDB, целиком локально, без сети.
//
// Поездка хранится ОДНИМ документом (D-006): для двоих за поездку это десятки
// килобайт, всё помещается в память, любой экран рисуется мгновенно и не ждёт
// курсоров. Рядом — журнал операций: append-only лента того, что произошло,
// чтобы историю можно было восстановить и показать «что я поменял».

const DB_NAME = 'sharetrip';
const DB_VERSION = 1;
const STORE_TRIPS = 'trips';
const STORE_JOURNAL = 'journal';
const STORE_META = 'meta';

let dbPromise = null;

/** true, если IndexedDB в этом браузере вообще доступна. */
export function storageAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!storageAvailable()) {
      reject(new Error('IndexedDB недоступна'));
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        db.createObjectStore(STORE_TRIPS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_JOURNAL)) {
        db.createObjectStore(STORE_JOURNAL, { keyPath: 'seq', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Не удалось открыть базу'));
    req.onblocked = () => reject(new Error('База занята другой вкладкой'));
  });
  return dbPromise;
}

function tx(db, stores, mode) {
  const t = db.transaction(stores, mode);
  return {
    t,
    done: new Promise((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Транзакция прервана'));
    }),
  };
}

function reqDone(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/* ------------------------------------------------------------------ trips */

export async function listTrips() {
  const db = await openDB();
  const { t } = tx(db, [STORE_TRIPS], 'readonly');
  const all = await reqDone(t.objectStore(STORE_TRIPS).getAll());
  return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getTrip(id) {
  const db = await openDB();
  const { t } = tx(db, [STORE_TRIPS], 'readonly');
  return reqDone(t.objectStore(STORE_TRIPS).get(id));
}

export async function putTrip(doc) {
  const db = await openDB();
  const { t, done } = tx(db, [STORE_TRIPS], 'readwrite');
  const record = { ...doc, updatedAt: new Date().toISOString() };
  t.objectStore(STORE_TRIPS).put(record);
  await done;
  return record;
}

export async function deleteTrip(id) {
  const db = await openDB();
  const { t, done } = tx(db, [STORE_TRIPS], 'readwrite');
  t.objectStore(STORE_TRIPS).delete(id);
  await done;
}

/* ---------------------------------------------------------------- journal */

/** Дописывает строку в журнал. Журнал только растёт — ничего не переписывается. */
export async function appendJournal(entry) {
  const db = await openDB();
  const { t, done } = tx(db, [STORE_JOURNAL], 'readwrite');
  t.objectStore(STORE_JOURNAL).add({ ...entry, at: new Date().toISOString() });
  await done;
}

export async function readJournal(limit = 200) {
  const db = await openDB();
  const { t } = tx(db, [STORE_JOURNAL], 'readonly');
  const all = await reqDone(t.objectStore(STORE_JOURNAL).getAll());
  return all.slice(-limit).reverse();
}

/* ------------------------------------------------------------------- meta */

export async function getMeta(key, fallback = null) {
  try {
    const db = await openDB();
    const { t } = tx(db, [STORE_META], 'readonly');
    const row = await reqDone(t.objectStore(STORE_META).get(key));
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export async function setMeta(key, value) {
  try {
    const db = await openDB();
    const { t, done } = tx(db, [STORE_META], 'readwrite');
    t.objectStore(STORE_META).put({ key, value });
    await done;
  } catch {
    /* настройка — не данные, потерять её не страшно */
  }
}

/* ------------------------------------------------------------ export/import */

/** Полный дамп для переноса на компьютер или в бэкап. */
export async function exportAll() {
  const trips = await listTrips();
  const journal = await readJournal(100000);
  return {
    format: 'sharetrip-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    trips,
    journal,
  };
}

/**
 * Восстановление из дампа. Поездки с совпадающим id заменяются целиком,
 * остальные добавляются. Ничего не удаляется молча.
 */
export async function importAll(dump, { replace = false } = {}) {
  if (!dump || dump.format !== 'sharetrip-backup') {
    throw new Error('Это не файл резервной копии ShareTrip');
  }
  if (!Array.isArray(dump.trips)) throw new Error('В файле нет поездок');

  const db = await openDB();
  const { t, done } = tx(db, [STORE_TRIPS], 'readwrite');
  const store = t.objectStore(STORE_TRIPS);
  if (replace) store.clear();
  for (const trip of dump.trips) {
    if (trip && trip.id) store.put(trip);
  }
  await done;
  return dump.trips.length;
}
