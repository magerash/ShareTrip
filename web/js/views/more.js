// views/more.js — курсы, настройки поездки, участники, категории,
// экспорт CSV и резервная копия. Отсюда данные уезжают на компьютер.

import * as store from '../store.js';
import { db } from '../store.js';
import {
  h, clear, field, sheet, toast, confirmSheet, amountInput, select, icon,
  formatDate, plural,
} from '../ui.js';
import {
  parseAmount, formatMoney, formatAmount, formatRate, normalizeRate, isValidRate,
} from '../money.js';
import { alive, byId, rateFor, ACCOUNT_KINDS } from '../model.js';
import { CURRENCY_OPTIONS, currencyName } from '../currencies.js';
import {
  fullCSV, expensesCSV, downloadCSV, downloadJSON, canDownload,
} from '../csv.js';

export function renderMore(state) {
  const home = state.trip.homeCurrency;
  const needed = neededCurrencies(state);

  return [
    /* ---- курсы ---- */
    h('div.card', null,
      h('div.card__head', null,
        h('h2', null, 'Курсы валют'),
        h('button.btn.btn--sm', { type: 'button', onclick: () => openRatesSheet() }, 'Изменить')),
      needed.length === 0
        ? h('p.muted.small', null, 'Все траты в домашней валюте — курсы не нужны.')
        : h('div', null, ...needed.map((c) => {
          const r = rateFor(state, c);
          return h('div.kv', null,
            h('span.kv__k', null, `${c} — ${currencyName(c)}`),
            h('span.kv__v.num', { class: r ? '' : 'neg' },
              r ? formatRate(r, c, home) : 'не задан'));
        })),
      h('div.field__hint', null,
        'Курс вводится руками и замораживается в каждой операции. Интернет не нужен: '
        + 'приложение никогда никуда не ходит за курсом.')),

    /* ---- поездка ---- */
    h('div.card', null,
      h('div.card__head', null,
        h('h2', null, 'Поездка'),
        h('button.btn.btn--sm', { type: 'button', onclick: () => openTripSheet() }, 'Изменить')),
      h('div.kv', null, h('span.kv__k', null, 'Название'), h('span.kv__v', null, state.trip.name)),
      h('div.kv', null, h('span.kv__k', null, 'Домашняя валюта'), h('span.kv__v', null, home)),
      h('div.kv', null, h('span.kv__k', null, 'Даты'),
        h('span.kv__v', null, [state.trip.startDate && formatDate(state.trip.startDate, { withYear: true }),
          state.trip.endDate && formatDate(state.trip.endDate, { withYear: true })].filter(Boolean).join(' — ') || '—')),
      h('div.kv', null, h('span.kv__k', null, 'Дневной бюджет'),
        h('span.kv__v.num', null, state.trip.dailyBudget ? formatMoney(state.trip.dailyBudget, home) : 'не задан')),
      h('div.kv', null, h('span.kv__k', null, 'Участники'),
        h('span.kv__v', null, alive(state.people).map((p) => p.name).join(', ')))),

    /* ---- категории ---- */
    h('div.card', null,
      h('div.card__head', null,
        h('h2', null, 'Категории'),
        h('button.btn.btn--sm', { type: 'button', onclick: () => openCategoriesSheet() }, 'Изменить')),
      h('div.chips', null, ...alive(state.categories).map((c) => h('span.pill', null, `${c.icon || '•'} ${c.name}`)))),

    /* ---- выгрузка ---- */
    h('div.card', null,
      h('div.card__head', null, h('h2', null, 'Выгрузка и перенос')),
      h('p.muted.small', null,
        'Данные лежат только в этом браузере. Перед тем как чистить историю или менять устройство — сделайте копию.'),
      h('div.grid2', null,
        h('button.btn', {
          type: 'button',
          onclick: () => offerFile(fileName(state, 'csv'),
            fullCSV(state, state.settings?.kittyMode), { label: 'CSV — вся поездка' }),
        }, icon('download', 19), 'CSV — всё'),
        h('button.btn', {
          type: 'button',
          onclick: () => offerFile(fileName(state, 'traty.csv'),
            expensesCSV(state), { label: 'CSV — траты' }),
        }, icon('download', 19), 'CSV — траты')),
      h('div.grid2', { style: { marginTop: '10px' } },
        h('button.btn.btn--navy', {
          type: 'button',
          onclick: async () => {
            await store.flush();
            const dump = await db.exportAll();
            offerFile(fileName(state, 'backup.json'), JSON.stringify(dump, null, 2),
              { label: 'Резервная копия' });
          },
        }, icon('download', 19), 'Резервная копия'),
        h('button.btn', { type: 'button', onclick: openImport }, 'Восстановить'))),

    /* ---- журнал ---- */
    h('div.card', null,
      h('div.card__head', null, h('h2', null, 'Журнал изменений')),
      h('p.muted.small', null, 'Каждое действие записывается отдельной строкой — можно посмотреть, что и когда менялось.'),
      h('button.btn.btn--block', { type: 'button', onclick: openJournal }, 'Открыть журнал')),

    h('p.center.small.muted', { style: { paddingTop: '8px' } },
      'ShareTrip · путешествуем вместе, считаем просто'),
  ];
}

/**
 * Отдать данные человеку. Где скачивание работает — файл; где запрещено
 * (встроенный просмотрщик) — текст, который можно выделить и скопировать.
 * Данные обязаны быть доступны всегда: они лежат только в этом браузере.
 */
function offerFile(filename, text, { label = 'Данные' } = {}) {
  if (canDownload()) {
    const okDownload = filename.endsWith('.json')
      ? downloadJSON(filename, JSON.parse(text))
      : downloadCSV(filename, text);
    if (okDownload) { toast('Файл сохранён'); return; }
  }

  sheet(label, () => {
    const area = h('textarea.textarea', {
      readOnly: true,
      value: text,
      style: { minHeight: '260px', fontFamily: 'var(--mono)', fontSize: '.78rem' },
      onfocus: (e) => e.target.select(),
    });
    const status = h('div.field__hint');

    const copy = async () => {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else { area.select(); document.execCommand('copy'); }
        status.textContent = 'Скопировано в буфер обмена.';
      } catch {
        area.select();
        status.textContent = 'Скопируйте вручную: текст выделен.';
      }
    };

    return [
      h('div.notice', null, h('span', null,
        'Здесь скачивание файлов запрещено браузером. Скопируйте текст и сохраните его сами — ',
        h('b', null, filename))),
      area,
      status,
      h('div.sheet__actions', null,
        h('button.btn.btn--primary.btn--block', { type: 'button', onclick: copy }, 'Скопировать')),
    ];
  });
}

function fileName(state, suffix) {
  const slug = (state.trip.name || 'trip').toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '') || 'trip';
  const date = new Date().toISOString().slice(0, 10);
  return `sharetrip-${slug}-${date}.${suffix.replace(/^\./, '')}`;
}

function neededCurrencies(state) {
  const home = state.trip.homeCurrency;
  const set = new Set();
  for (const a of alive(state.accounts)) if (a.currency !== home) set.add(a.currency);
  for (const e of alive(state.expenses)) if (e.currency !== home) set.add(e.currency);
  return [...set].sort();
}

/* ------------------------------------------------------------- курсы */

export function openRatesSheet() {
  const state = store.getState();
  const home = state.trip.homeCurrency;

  sheet('Курсы валют', (close) => {
    const body = h('div');
    const draft = {};

    const redraw = () => {
      clear(body);
      const all = new Set([...neededCurrencies(state), ...Object.keys(state.rates)]);
      const list = [...all].sort();

      body.append(h('p.muted.small', null,
        `Сколько ${home} за 1 единицу валюты. Этот курс подставляется в новые траты; `
        + 'уже сохранённые остаются со своим замороженным курсом.'));

      for (const c of list) {
        body.append(field(`${c} — ${currencyName(c)}`,
          amountInput(draft[c] ?? (rateFor(state, c) || ''), {
            placeholder: '0',
            oninput: (e) => { draft[c] = e.target.value; },
          }),
          { hint: rateFor(state, c) ? formatRate(rateFor(state, c), c, home) : 'не задан' }));
      }

      const add = { code: CURRENCY_OPTIONS.find((o) => !all.has(o.value))?.value || 'USD', rate: '' };
      body.append(h('h3', { style: { marginTop: '16px' } }, 'Добавить валюту'));
      body.append(h('div.grid2', null,
        field('Валюта', select(CURRENCY_OPTIONS.filter((o) => o.value !== home), add.code,
          (e) => { add.code = e.target.value; })),
        field('Курс', amountInput('', { oninput: (e) => { add.rate = e.target.value; } }))));
      body.append(h('button.btn.btn--block', {
        type: 'button',
        onclick: () => {
          if (!isValidRate(add.rate)) { toast('Курс должен быть числом больше нуля'); return; }
          store.setRate(add.code, add.rate);
          toast(`Курс ${add.code} сохранён`);
          redraw();
        },
      }, 'Добавить'));

      body.append(h('div.sheet__actions', null,
        h('button.btn.btn--primary.btn--block', {
          type: 'button',
          onclick: () => {
            let bad = null;
            for (const [code, value] of Object.entries(draft)) {
              const v = String(value).trim();
              if (v === '') { store.setRate(code, null); continue; }
              if (!isValidRate(v)) { bad = code; break; }
              store.setRate(code, v);
            }
            if (bad) { toast(`Курс ${bad} — не число`); return; }
            close();
            toast('Курсы сохранены');
          },
        }, 'Сохранить')));
    };

    redraw();
    return body;
  });
}

/* ------------------------------------------------------------ поездка */

export function openTripSheet() {
  const state = store.getState();
  const d = {
    name: state.trip.name,
    homeCurrency: state.trip.homeCurrency,
    startDate: state.trip.startDate || '',
    endDate: state.trip.endDate || '',
    budgetText: state.trip.dailyBudget ? formatAmount(state.trip.dailyBudget, state.trip.homeCurrency) : '',
    people: alive(state.people).map((p) => ({ id: p.id, name: p.name })),
  };

  sheet('Поездка', (close) => [
    field('Название', h('input.input', {
      type: 'text', value: d.name, oninput: (e) => { d.name = e.target.value; },
    })),
    field('Домашняя валюта', select(
      CURRENCY_OPTIONS, d.homeCurrency, (e) => { d.homeCurrency = e.target.value; },
    ), {
      hint: 'Меняет валюту итогов. Замороженные курсы сохранённых трат не пересчитываются — '
        + 'после смены проверьте курсы.',
    }),
    h('div.grid2', null,
      field('Начало', h('input.input', {
        type: 'date', value: d.startDate, oninput: (e) => { d.startDate = e.target.value; },
      })),
      field('Конец', h('input.input', {
        type: 'date', value: d.endDate, oninput: (e) => { d.endDate = e.target.value; },
      }))),
    field('Дневной бюджет', amountInput(d.budgetText, {
      oninput: (e) => { d.budgetText = e.target.value; },
    }), { hint: 'Необязательно. Показывает, сколько в день остаётся в запасе.' }),

    h('h3', { style: { marginTop: '14px' } }, 'Участники'),
    ...d.people.map((p) => field('Имя', h('input.input', {
      type: 'text', value: p.name, oninput: (e) => { p.name = e.target.value; },
    }))),

    h('div.sheet__actions', null,
      h('button.btn.btn--primary.btn--block', {
        type: 'button',
        onclick: () => {
          const budget = d.budgetText ? parseAmount(d.budgetText, d.homeCurrency) : 0;
          store.setTripField({
            name: d.name.trim() || 'Поездка',
            homeCurrency: d.homeCurrency,
            startDate: d.startDate,
            endDate: d.endDate,
            dailyBudget: budget || 0,
          });
          for (const p of d.people) {
            const name = p.name.trim();
            if (name) store.updatePerson(p.id, { name });
          }
          close();
          toast('Сохранено');
        },
      }, 'Сохранить')),
  ]);
}

/* --------------------------------------------------------- категории */

export function openCategoriesSheet() {
  sheet('Категории', (close) => {
    const body = h('div');
    const draft = { name: '', icon: '' };

    const redraw = () => {
      const state = store.getState();
      clear(body);
      for (const c of alive(state.categories)) {
        const used = alive(state.expenses).filter((e) => e.categoryId === c.id).length;
        body.append(h('div.item', null,
          h('div.item__icon', null, c.icon || '•'),
          h('div.item__body', null,
            h('div.item__title', null, c.name),
            h('div.item__sub', null, used
              ? `${used} ${plural(used, 'трата', 'траты', 'трат')}`
              : 'не использовалась')),
          h('button.btn.btn--sm.btn--danger', {
            type: 'button',
            onclick: async () => {
              if (used) { toast('Категория используется — сначала перенесите траты'); return; }
              if (await confirmSheet('Убрать категорию?', c.name, { danger: true, okText: 'Убрать' })) {
                store.deleteCategory(c.id);
                redraw();
              }
            },
          }, '×')));
      }

      body.append(h('h3', { style: { marginTop: '16px' } }, 'Новая категория'));
      body.append(h('div.grid2', null,
        field('Значок', h('input.input', {
          type: 'text', maxLength: 2, placeholder: '🍷',
          oninput: (e) => { draft.icon = e.target.value; },
        })),
        field('Название', h('input.input', {
          type: 'text', placeholder: 'Бар',
          oninput: (e) => { draft.name = e.target.value; },
        }))));
      body.append(h('button.btn.btn--block', {
        type: 'button',
        onclick: () => {
          const name = draft.name.trim();
          if (!name) { toast('Введите название'); return; }
          store.addCategory(name, draft.icon.trim() || '•');
          draft.name = ''; draft.icon = '';
          redraw();
          toast('Категория добавлена');
        },
      }, 'Добавить'));

      body.append(h('div.sheet__actions', null,
        h('button.btn.btn--primary.btn--block', { type: 'button', onclick: () => close() }, 'Готово')));
    };

    redraw();
    return body;
  });
}

/* ---------------------------------------------------------- перенос */

function openImport() {
  sheet('Восстановить из копии', (close) => {
    const status = h('div');
    const input = h('input.input', {
      type: 'file', accept: 'application/json,.json',
      onchange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        clear(status);
        try {
          const text = await file.text();
          const dump = JSON.parse(text);
          const { count } = await store.importDump(dump, { replace: false });
          status.append(h('div.notice', null,
            `Восстановлено ${count} ${plural(count, 'поездка', 'поездки', 'поездок')}.`));
          setTimeout(() => { close(); toast('Данные восстановлены'); }, 900);
        } catch (err) {
          status.append(h('div.notice.notice--danger', null, `Не получилось: ${err.message}`));
        }
      },
    });

    return [
      h('p.muted', null,
        'Выберите файл резервной копии (.json). Поездки с тем же идентификатором заменятся, '
        + 'остальные добавятся. Ничего не удаляется без спроса.'),
      field('Файл копии', input),
      status,
    ];
  });
}

function openJournal() {
  sheet('Журнал изменений', () => {
    const body = h('div', null, h('p.muted', null, 'Загружаю…'));
    db.readJournal(300).then((rows) => {
      clear(body);
      if (!rows.length) { body.append(h('p.muted', null, 'Пока пусто.')); return; }
      for (const r of rows) {
        const when = r.at ? new Date(r.at) : null;
        body.append(h('div.kv', null,
          h('span.kv__k.mono', null, r.op || '?'),
          h('span.kv__v.small.muted', null,
            when ? `${when.toLocaleDateString('ru-RU')} ${when.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : '')));
      }
    }).catch((err) => {
      clear(body);
      body.append(h('div.notice.notice--danger', null, err.message));
    });
    return body;
  });
}
