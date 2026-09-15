// views/accounts.js — счета, остатки и переводы между ними.
// Здесь живёт обменник, банкомат и общая касса.

import * as store from '../store.js';
import {
  h, mount, clear, field, sheet, toast, confirmSheet, amountInput, select, icon,
  formatDate, segmented,
} from '../ui.js';
import {
  parseAmount, formatMoney, formatAmount, formatRate, impliedRate, normalizeRate,
} from '../money.js';
import {
  alive, byId, todayISO, accountBalances, toHome, rateFor, ACCOUNT_KINDS,
} from '../model.js';
import { validateTransfer } from '../split.js';
import { CURRENCY_OPTIONS } from '../currencies.js';

const KIND_LABEL = { card: 'Карта', cash: 'Наличные', kitty: 'Общая касса' };
const KIND_ICON = { card: '💳', cash: '💵', kitty: '🧺' };

export function renderAccounts(state) {
  const home = state.trip.homeCurrency;
  const bal = accountBalances(state);
  const accounts = alive(state.accounts);

  const out = [];

  let total = 0;
  let complete = true;
  for (const a of accounts) {
    const v = toHome(state, bal[a.id] || 0, a.currency);
    if (v === null) complete = false; else total += v;
  }

  out.push(h('div.card', null,
    h('div.card__head', null, h('h2', null, 'На руках')),
    h('div.hero__value.num', { style: { fontSize: '1.9rem', fontWeight: '800' } },
      complete ? formatMoney(total, home) : '— курс не задан'),
    h('div.field__hint', null, 'Сумма всех счетов в домашней валюте по курсам поездки.')));

  // Группируем: люди, потом общее.
  for (const p of alive(state.people)) {
    const own = accounts.filter((a) => a.ownerId === p.id);
    if (!own.length) continue;
    out.push(h('div.card', null,
      h('div.card__head', null, h('h2', null, p.name)),
      ...own.map((a) => accountRow(state, a, bal[a.id] || 0))));
  }

  const shared = accounts.filter((a) => !a.ownerId);
  if (shared.length) {
    out.push(h('div.card', null,
      h('div.card__head', null, h('h2', null, 'Общее')),
      ...shared.map((a) => accountRow(state, a, bal[a.id] || 0))));
  }

  out.push(h('div.grid2', null,
    h('button.btn.btn--navy', { type: 'button', onclick: () => openTransferSheet() },
      icon('swap', 19), 'Перевод / обмен'),
    h('button.btn', { type: 'button', onclick: () => openAccountSheet() },
      icon('plus', 19), 'Новый счёт')));

  const transfers = alive(state.transfers).slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  if (transfers.length) {
    out.push(h('div.card', null,
      h('div.card__head', null, h('h2', null, 'Переводы и обмены')),
      ...transfers.map((t) => transferRow(state, t))));
  }

  return out;
}

function accountRow(state, a, balance) {
  const home = state.trip.homeCurrency;
  const inHome = toHome(state, balance, a.currency);
  return h('button.item', {
    type: 'button', onclick: () => openAccountSheet(a.id),
  },
  h('div.item__icon', null, KIND_ICON[a.kind] || '💳'),
  h('div.item__body', null,
    h('div.item__title', null, a.name),
    h('div.item__sub', null, `${KIND_LABEL[a.kind] || a.kind} · ${a.currency}`)),
  h('div.item__amount.num', null,
    h('b', { class: balance < 0 ? 'neg' : '' }, formatMoney(balance, a.currency)),
    a.currency !== home
      ? h('span', null, inHome === null ? 'курс не задан' : formatMoney(inHome, home))
      : null));
}

function transferRow(state, t) {
  const from = byId(state.accounts, t.fromAccountId);
  const to = byId(state.accounts, t.toAccountId);
  const rate = t.rate || impliedRate(t.amountOut, from?.currency || 'RUB', t.amountIn, to?.currency || 'RUB');
  const sameCurrency = from?.currency === to?.currency;
  return h('button.item', {
    type: 'button', onclick: () => openTransferSheet(t.id),
  },
  h('div.item__icon', null, '⇄'),
  h('div.item__body', null,
    h('div.item__title', null, `${from?.name || '?'} → ${to?.name || '?'}`),
    h('div.item__sub', null,
      [formatDate(t.date),
        !sameCurrency && rate ? formatRate(rate, to?.currency, from?.currency) : null,
        t.feeAmount ? `комиссия ${formatMoney(t.feeAmount, from?.currency)}` : null,
        t.note]
        .filter(Boolean).join(' · '))),
  h('div.item__amount.num', null,
    h('b', null, `−${formatMoney(t.amountOut, from?.currency || 'RUB')}`),
    h('span', null, `+${formatMoney(t.amountIn, to?.currency || 'RUB')}`)));
}

/* --------------------------------------------------------------- счёт */

export function openAccountSheet(accountId = null) {
  const state = store.getState();
  const existing = accountId ? byId(state.accounts, accountId) : null;
  const people = alive(state.people);

  const d = existing ? {
    name: existing.name,
    ownerId: existing.ownerId || '',
    kind: existing.kind,
    currency: existing.currency,
    openingText: formatAmount(existing.opening || 0, existing.currency),
  } : {
    name: '',
    ownerId: people[0]?.id || '',
    kind: ACCOUNT_KINDS.CASH,
    currency: state.trip.homeCurrency,
    openingText: '',
  };

  sheet(existing ? 'Счёт' : 'Новый счёт', (close) => {
    const errBox = h('div');
    const body = h('div');
    const redraw = () => { clear(body); mount(body, form()); };

    function form() {
      const isKitty = d.kind === ACCOUNT_KINDS.KITTY;
      return [
        field('Тип', segmented([
          { value: ACCOUNT_KINDS.CARD, label: '💳 Карта' },
          { value: ACCOUNT_KINDS.CASH, label: '💵 Наличные' },
          { value: ACCOUNT_KINDS.KITTY, label: '🧺 Касса' },
        ], d.kind, (v) => {
          d.kind = v;
          if (v === ACCOUNT_KINDS.KITTY) d.ownerId = '';
          else if (!d.ownerId) d.ownerId = people[0]?.id || '';
          redraw();
        }), {
          hint: isKitty
            ? 'Общий котёл: оба скидываются переводом, из него платятся общие траты, остаток делится в конце.'
            : undefined,
        }),
        field('Название', h('input.input', {
          type: 'text', value: d.name,
          placeholder: isKitty ? 'Общая касса' : 'Наличные манаты',
          oninput: (e) => { d.name = e.target.value; },
        })),
        !isKitty ? field('Чей', select(
          people.map((p) => ({ value: p.id, label: p.name })), d.ownerId,
          (e) => { d.ownerId = e.target.value; },
        )) : null,
        field('Валюта', select(
          CURRENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label })), d.currency,
          (e) => { d.currency = e.target.value; redraw(); },
        ), { hint: 'Один счёт — одна валюта. Для второй валюты заведите ещё один счёт.' }),
        field('Начальный остаток', amountInput(d.openingText, {
          oninput: (e) => { d.openingText = e.target.value; },
        }), { hint: 'Сколько было на счету к началу поездки. Можно оставить нулём.' }),
        errBox,
        h('div.sheet__actions', null,
          existing ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              const used = isAccountUsed(state, existing.id);
              const msg = used
                ? 'По этому счёту есть операции. Он скроется из списка, но записи и расчёт останутся.'
                : 'Счёт скроется из списка.';
              if (await confirmSheet('Убрать счёт?', msg, { danger: true, okText: 'Убрать' })) {
                store.deleteAccount(existing.id);
                close();
                toast('Счёт убран');
              }
            },
          }, 'Убрать') : null,
          h('button.btn.btn--primary.btn--block', { type: 'button', onclick: save }, 'Сохранить')),
      ];
    }

    function save() {
      clear(errBox);
      const opening = parseAmount(d.openingText || '0', d.currency);
      if (opening == null) {
        errBox.append(h('div.notice.notice--danger', null, 'Начальный остаток — не число'));
        return;
      }
      const name = d.name.trim() || (d.kind === ACCOUNT_KINDS.KITTY ? 'Общая касса' : `${KIND_LABEL[d.kind]} ${d.currency}`);
      const rec = {
        name,
        ownerId: d.kind === ACCOUNT_KINDS.KITTY ? null : (d.ownerId || null),
        kind: d.kind,
        currency: d.currency,
        opening,
      };
      if (existing) store.updateAccount(existing.id, rec);
      else store.addAccount(rec);
      close();
      toast('Сохранено');
    }

    redraw();
    return body;
  });
}

function isAccountUsed(state, id) {
  return alive(state.expenses).some((e) => e.payers.some((p) => p.accountId === id))
    || alive(state.transfers).some((t) => t.fromAccountId === id || t.toAccountId === id);
}

/* ------------------------------------------------------------- перевод */

export function openTransferSheet(transferId = null) {
  const state = store.getState();
  const accounts = alive(state.accounts);
  const existing = transferId ? byId(state.transfers, transferId) : null;

  const d = existing ? {
    fromAccountId: existing.fromAccountId,
    toAccountId: existing.toAccountId,
    outText: formatAmount(existing.amountOut, accCur(state, existing.fromAccountId)),
    inText: formatAmount(existing.amountIn, accCur(state, existing.toAccountId)),
    feeText: existing.feeAmount ? formatAmount(existing.feeAmount, accCur(state, existing.fromAccountId)) : '',
    date: existing.date,
    note: existing.note || '',
    useAsTripRate: false,
  } : {
    fromAccountId: accounts[0]?.id,
    toAccountId: accounts.find((a, i) => i > 0)?.id || accounts[0]?.id,
    outText: '',
    inText: '',
    feeText: '',
    date: todayISO(),
    note: '',
    useAsTripRate: true,
  };

  sheet(existing ? 'Перевод' : 'Перевод и обмен', (close) => {
    const errBox = h('div');
    const body = h('div');
    const redraw = () => { clear(body); mount(body, form()); };

    const fromCur = () => accCur(state, d.fromAccountId);
    const toCur = () => accCur(state, d.toAccountId);

    function form() {
      const opts = accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }));
      const same = fromCur() === toCur();

      return [
        h('div.grid2', null,
          field('Откуда', select(opts, d.fromAccountId, (e) => { d.fromAccountId = e.target.value; redraw(); })),
          field('Куда', select(opts, d.toAccountId, (e) => { d.toAccountId = e.target.value; redraw(); }))),

        field(`Ушло, ${fromCur()}`, amountInput(d.outText, {
          oninput: (e) => {
            d.outText = e.target.value;
            if (same) d.inText = e.target.value;
            refresh();
          },
        })),

        !same ? field(`Пришло, ${toCur()}`, amountInput(d.inText, {
          oninput: (e) => { d.inText = e.target.value; refresh(); },
        }), { hint: 'Ровно столько, сколько дали на руки. Курс посчитается сам.' }) : null,

        field(`Комиссия, ${fromCur()}`, amountInput(d.feeText, {
          oninput: (e) => { d.feeText = e.target.value; refresh(); },
        }), { hint: 'Сверх суммы, если банк взял отдельно. Можно оставить пустым.' }),

        h('div#implied'),

        field('Дата', h('input.input', {
          type: 'date', value: d.date, oninput: (e) => { d.date = e.target.value; },
        })),
        field('Заметка', h('input.input', {
          type: 'text', value: d.note, placeholder: 'Обменник у метро / банкомат',
          oninput: (e) => { d.note = e.target.value; },
        })),
        errBox,
        h('div.sheet__actions', null,
          existing ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              if (await confirmSheet('Удалить перевод?', 'Остатки счетов пересчитаются.', { danger: true })) {
                store.deleteTransfer(existing.id);
                close();
                toast('Перевод удалён');
              }
            },
          }, 'Удалить') : null,
          h('button.btn.btn--primary.btn--block', { type: 'button', onclick: save }, 'Сохранить')),
      ];
    }

    function refresh() {
      const box = body.querySelector('#implied');
      if (!box) return;
      clear(box);
      const out = parseAmount(d.outText, fromCur());
      const inc = parseAmount(d.inText, toCur());
      if (fromCur() === toCur() || !out || !inc) return;

      const rate = impliedRate(out, fromCur(), inc, toCur());
      if (!rate) return;
      const tripRate = rateFor(state, toCur());
      const isHome = fromCur() === state.trip.homeCurrency;

      box.append(h('div.notice', null, h('span', null,
        h('b', null, 'Фактический курс: '), formatRate(rate, toCur(), fromCur()),
        tripRate ? ` · курс поездки ${formatRate(tripRate, toCur(), state.trip.homeCurrency)}` : '')));

      if (isHome) {
        box.append(h('label.switch-row', null,
          h('input', {
            type: 'checkbox', checked: d.useAsTripRate,
            onchange: (e) => { d.useAsTripRate = e.target.checked; },
          }),
          h('span.switch-row__label', null, 'Сделать курсом поездки',
            h('small', null, 'Новые траты в этой валюте будут считаться по нему. Уже сохранённые не изменятся.'))));
      }
    }

    function save() {
      clear(errBox);
      const out = parseAmount(d.outText, fromCur());
      const inc = fromCur() === toCur() ? out : parseAmount(d.inText, toCur());
      const fee = d.feeText ? parseAmount(d.feeText, fromCur()) : 0;

      const rec = {
        date: d.date,
        fromAccountId: d.fromAccountId,
        toAccountId: d.toAccountId,
        amountOut: out,
        amountIn: inc,
        feeAmount: fee || 0,
        note: d.note.trim(),
      };
      const errs = validateTransfer(rec, state);
      if (errs.length) {
        errBox.append(h('div.notice.notice--danger', null, errs.join('. ')));
        return;
      }
      rec.rate = impliedRate(rec.amountOut, fromCur(), rec.amountIn, toCur());

      if (existing) store.updateTransfer(existing.id, rec);
      else store.addTransfer(rec);

      if (d.useAsTripRate && fromCur() === state.trip.homeCurrency && rec.rate) {
        store.setRate(toCur(), rec.rate);
      }
      close();
      toast('Сохранено');
    }

    redraw();
    setTimeout(refresh, 0);
    return body;
  });
}

function accCur(state, id) {
  return byId(state.accounts, id)?.currency || state.trip.homeCurrency;
}
