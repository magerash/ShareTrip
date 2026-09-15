// app.js — оболочка: загрузка, навигация, первый запуск.
// Экраны живут в js/views/*, денежная логика — в money.js и model.js.

import * as store from './store.js';
import { storageAvailable } from './db.js';
import { h, mount, clear, icon, toast, field, segmented, sheet, wordmark } from './ui.js';
import { CURRENCY_OPTIONS } from './currencies.js';
import { todayISO } from './model.js';
import { renderExpenses, openExpenseSheet } from './views/expenses.js';
import { renderAccounts } from './views/accounts.js';
import { renderSettle } from './views/settle.js';
import { renderMore } from './views/more.js';

const TABS = [
  { id: 'expenses', label: 'Траты', icon: 'list', render: renderExpenses },
  { id: 'accounts', label: 'Счета', icon: 'wallet', render: renderAccounts },
  { id: 'settle', label: 'Итог', icon: 'scale', render: renderSettle },
  { id: 'more', label: 'Ещё', icon: 'dots', render: renderMore },
];

let currentTab = 'expenses';
let root = null;

/* ------------------------------------------------------------- отрисовка */

export function render() {
  const state = store.getState();
  clear(root);

  if (!state) { root.append(renderWelcome()); return; }

  const tab = TABS.find((t) => t.id === currentTab) || TABS[0];

  mount(root,
    renderTopbar(state),
    h('main.app', null, h('div.view', null, tab.render(state))),
    tab.id === 'expenses'
      ? h('button.fab', { type: 'button', 'aria-label': 'Новая трата', onclick: () => openExpenseSheet() }, '+')
      : null,
    renderNav(),
  );

  const err = store.getSaveError();
  if (err) {
    document.querySelector('.view')?.prepend(
      h('div.notice.notice--danger', null,
        h('span', null, 'Не удалось сохранить на устройство. Выгрузите резервную копию на вкладке «Ещё», пока данные в памяти.')),
    );
  }
}

function renderTopbar(state) {
  const sub = [state.trip.startDate && formatRange(state.trip), `${state.trip.homeCurrency}`]
    .filter(Boolean).join(' · ');
  return h('header.topbar', null,
    h('img.topbar__logo', { src: 'assets/symbol.png', alt: 'ShareTrip', width: 30, height: 30 }),
    h('div.topbar__title', null,
      h('b', null, state.trip.name),
      h('small', null, sub)),
  );
}

function formatRange(trip) {
  if (!trip.startDate) return '';
  const f = (iso) => iso.split('-').reverse().slice(0, 2).join('.');
  return trip.endDate ? `${f(trip.startDate)}–${f(trip.endDate)}` : `с ${f(trip.startDate)}`;
}

function renderNav() {
  const nav = h('nav.nav', { 'aria-label': 'Разделы' });
  for (const t of TABS) {
    nav.append(h('button', {
      type: 'button',
      'aria-current': currentTab === t.id ? 'page' : null,
      onclick: () => { currentTab = t.id; render(); window.scrollTo(0, 0); },
    }, icon(t.icon), h('span', null, t.label)));
  }
  return nav;
}

export function goTab(id) {
  currentTab = id;
  render();
  window.scrollTo(0, 0);
}

/* -------------------------------------------------------- первый запуск */

function renderWelcome() {
  return h('div.splash', null,
    wordmark(40),
    h('p', null, 'Путешествуем вместе. Считаем просто.'),
    h('p.small.muted', null,
      'Мультивалютные счета, ручной курс, замороженный в момент траты, и прямой ответ на вопрос «кто кому должен». Всё считается на устройстве — сеть не нужна.'),
    h('button.btn.btn--primary.btn--block', { type: 'button', onclick: openTripSetup }, 'Создать поездку'),
  );
}

export function openTripSetup() {
  const draft = {
    name: '',
    homeCurrency: 'RUB',
    p1: 'Ксюша',
    p2: 'Вова',
    startDate: todayISO(),
    endDate: '',
  };

  sheet('Новая поездка', (close) => {
    const err = h('div');

    const submit = async () => {
      clear(err);
      const name = draft.name.trim() || 'Поездка';
      const people = [draft.p1.trim() || 'Я', draft.p2.trim()].filter(Boolean);
      if (people.length < 2) {
        err.append(h('div.notice', null, 'Нужны оба имени — приложение считает долг между двумя.'));
        return;
      }
      try {
        await store.createTrip({
          name,
          homeCurrency: draft.homeCurrency,
          people,
          startDate: draft.startDate,
          endDate: draft.endDate,
        });
        close();
        toast('Поездка создана');
      } catch (e) {
        err.append(h('div.notice.notice--danger', null, `Не удалось создать: ${e.message}`));
      }
    };

    return [
      field('Куда едем', h('input.input', {
        type: 'text', value: draft.name, placeholder: 'Баку',
        enterkeyhint: 'next',
        oninput: (e) => { draft.name = e.target.value; },
      })),
      h('div.grid2', null,
        field('Кто первый', h('input.input', {
          type: 'text', value: draft.p1, placeholder: 'Ксюша', autocomplete: 'off',
          oninput: (e) => { draft.p1 = e.target.value; },
        })),
        field('Кто второй', h('input.input', {
          type: 'text', value: draft.p2, placeholder: 'Вова', autocomplete: 'off',
          oninput: (e) => { draft.p2 = e.target.value; },
        }))),
      field('Домашняя валюта',
        h('select.select', {
          onchange: (e) => { draft.homeCurrency = e.target.value; },
        }, ...CURRENCY_OPTIONS.map((o) => h('option', {
          value: o.value, selected: o.value === draft.homeCurrency,
        }, o.label))),
        { hint: 'В ней считается итог и «кто кому должен». Потом её можно поменять.' }),
      h('div.grid2', null,
        field('Начало', h('input.input', {
          type: 'date', value: draft.startDate,
          oninput: (e) => { draft.startDate = e.target.value; },
        })),
        field('Конец', h('input.input', {
          type: 'date', value: draft.endDate,
          oninput: (e) => { draft.endDate = e.target.value; },
        }), { hint: 'Можно оставить пустым' })),
      err,
      h('div.sheet__actions', null,
        h('button.btn.btn--primary.btn--block', { type: 'button', onclick: submit }, 'Поехали')),
    ];
  });
}

/* ------------------------------------------------------------- запуск */

async function boot() {
  root = document.getElementById('root');

  if (!storageAvailable()) {
    root.append(h('div.splash', null,
      h('h1', null, 'Хранилище недоступно'),
      h('p.muted', null,
        'Браузер запретил локальную базу — так бывает в режиме инкогнито. Откройте приложение в обычном окне, иначе записи некуда сохранять.')));
    return;
  }

  store.subscribe(() => render());

  try {
    const loaded = await store.loadLast();
    if (!loaded) render();
  } catch (e) {
    console.error(e);
    root.append(h('div.splash', null,
      h('h1', null, 'Не удалось открыть данные'),
      h('p.muted', null, e.message)));
    return;
  }

  render();

  // Сохраняем немедленно, когда вкладку сворачивают или закрывают.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.flush();
  });
  window.addEventListener('pagehide', () => store.flush());

  // Только на собственном домене и в собственной вкладке: внутри песочницы
  // просмотрщика артефактов кэш не нужен и мешает обновлениям.
  const ownTab = (() => { try { return window.self === window.top; } catch { return false; } })();
  if (ownTab && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-кэш необязателен */ });
  }
}

boot();
