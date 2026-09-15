// views/settle.js — «кто кому должен».
// Одна фраза сверху, полная разбивка по тапу. Никакого «упрощения долгов»:
// для двоих оно бессмысленно, а по жалобам — главный источник непонимания.

import * as store from '../store.js';
import {
  h, mount, clear, field, sheet, toast, confirmSheet, amountInput, select, segmented,
  formatDate, plural,
} from '../ui.js';
import { parseAmount, formatMoney, formatAmount, convert } from '../money.js';
import {
  alive, byId, todayISO, settlementPlan, tripTotals, rateFor, accountBalances,
  ACCOUNT_KINDS,
} from '../model.js';

export function renderSettle(state) {
  const home = state.trip.homeCurrency;
  const mode = state.settings?.kittyMode || 'contribution';
  const plan = settlementPlan(state, mode);
  const people = alive(state.people);
  const out = [];

  if (plan.missingRates.length) {
    out.push(h('div.notice', null, h('span', null,
      h('b', null, 'Расчёт неполон: '),
      `нет курса для ${plan.missingRates.join(', ')}. Задайте курс на вкладке «Ещё».`)));
  }

  /* --- приговор --- */
  out.push(renderVerdict(state, plan));

  /* --- разбивка --- */
  const breakdown = h('div.card', null,
    h('div.card__head', null, h('h2', null, 'Откуда взялась эта цифра')));

  for (const p of people) {
    mount(breakdown, h('h3', { style: { marginTop: '12px' } }, p.name));
    mount(breakdown,
      kv('Оплата общих трат', formatMoney(plan.paidExpenses[p.id] || 0, home)),
      (plan.kitty[p.id] || 0) !== 0 ? kv('Взнос в общую кассу', formatMoney(plan.kitty[p.id], home)) : null,
      (plan.paidSettled[p.id] || 0) !== 0 ? kv('Возврат долга', formatMoney(plan.paidSettled[p.id], home)) : null,
      kv('Доля в тратах', `−${formatMoney(plan.shareOf[p.id] || 0, home)}`),
      (plan.refund[p.id] || 0) !== 0 ? kv('Доля остатка кассы', `−${formatMoney(plan.refund[p.id], home)}`) : null,
      kvStrong('Итого', plan.final[p.id]),
    );
  }
  out.push(breakdown);

  /* --- остаток общей кассы --- */
  if (plan.leftover !== 0 || plan.kittyOnHand) {
    out.push(renderKitty(state, plan, mode));
  }

  /* --- действия --- */
  if (!plan.settled) {
    out.push(h('button.btn.btn--primary.btn--block', {
      type: 'button', onclick: () => openSettleSheet(plan),
    }, 'Записать расчёт'));
  }

  /* --- уже записанные расчёты --- */
  const done = alive(state.settlements).slice().sort((a, b) => b.date.localeCompare(a.date));
  if (done.length) {
    out.push(h('div.card', null,
      h('div.card__head', null, h('h2', null, 'Расчёты')),
      ...done.map((s) => settlementRow(state, s))));
  }

  /* --- траты по участникам --- */
  const totals = tripTotals(state);
  const byPerson = h('div.card', null,
    h('div.card__head', null, h('h2', null, 'Доли в тратах')));
  for (const p of people) {
    const v = totals.byPerson[p.id] || 0;
    const pct = totals.spent ? Math.round((v / totals.spent) * 100) : 0;
    byPerson.append(
      h('div.kv', null,
        h('span.kv__k', null, p.name),
        h('span.kv__v.num', null, `${formatMoney(v, home)} · ${pct}%`)),
      h('div.bar', null, h('i', { style: { width: `${pct}%` } })));
  }
  out.push(byPerson);

  return out;
}

function renderVerdict(state, plan) {
  const home = state.trip.homeCurrency;
  if (plan.settled) {
    return h('div.card.verdict.verdict--settled', null,
      h('div.verdict__amount', null, '✓ Всё рассчитано'),
      h('div.verdict__who', null, 'Никто никому не должен.'));
  }
  const t = plan.transfers[0];
  const from = byId(state.people, t.fromPersonId)?.name || '?';
  const to = byId(state.people, t.toPersonId)?.name || '?';

  return h('div.card.verdict', null,
    h('div.verdict__who', null, `${from}\u2002→\u2002${to}`),
    h('div.verdict__amount.num', null, formatMoney(t.amount, home)),
    h('div.verdict__who', null, 'столько нужно отдать, чтобы выйти в ноль'),
    plan.transfers.length > 1
      ? h('div.verdict__who', null, `и ещё ${plan.transfers.length - 1} ${plural(plan.transfers.length - 1, 'перевод', 'перевода', 'переводов')}`)
      : null);
}

function kv(k, v) {
  return h('div.kv', null, h('span.kv__k', null, k), h('span.kv__v.num', null, v));
}

function kvStrong(k, minor) {
  const state = store.getState();
  const cls = minor > 0 ? 'pos' : (minor < 0 ? 'neg' : '');
  // Без «должен/должна»: род по имени не определить.
  const text = minor === 0 ? 'в расчёте'
    : (minor > 0 ? `переплата ${formatMoney(minor, state.trip.homeCurrency)}`
      : `долг ${formatMoney(-minor, state.trip.homeCurrency)}`);
  return h('div.kv', null,
    h('span.kv__k', null, h('b', null, k)),
    h('span.kv__v.num', { class: cls }, text));
}

function renderKitty(state, plan, mode) {
  const home = state.trip.homeCurrency;
  const kittyAccs = alive(state.accounts).filter((a) => a.kind === ACCOUNT_KINDS.KITTY);
  const bal = accountBalances(state);

  const card = h('div.card', null,
    h('div.card__head', null, h('h2', null, 'Общая касса')));

  for (const a of kittyAccs) {
    card.append(kv(a.name, formatMoney(bal[a.id] || 0, a.currency)));
  }
  card.append(kv('Остаток к делению', formatMoney(plan.leftover, home)));

  if (plan.fxDrift && Math.abs(plan.fxDrift) > 0) {
    mount(card,h('div.field__hint', null,
      `В кассе физически ${formatMoney(plan.kittyOnHand, home)} по текущему курсу поездки. `
      + `Разница ${formatMoney(Math.abs(plan.fxDrift), home)} — это расхождение между курсами, `
      + 'замороженными в операциях, и нынешним курсом поездки. Делится именно та сумма, что выше: так книги сходятся в ноль.'));
  }

  card.append(h('div.field', { style: { marginTop: '12px' } },
    h('span.field__label', null, 'Как делить остаток'),
    segmented([
      { value: 'contribution', label: 'По взносам' },
      { value: 'equal', label: 'Поровну' },
    ], mode, (v) => store.setSetting({ kittyMode: v }))));

  return card;
}

function settlementRow(state, s) {
  const from = byId(state.people, s.fromPersonId)?.name || '?';
  const to = byId(state.people, s.toPersonId)?.name || '?';
  return h('button.item', {
    type: 'button',
    onclick: async () => {
      if (await confirmSheet('Удалить расчёт?', 'Долг вернётся в исходное состояние.', { danger: true })) {
        store.deleteSettlement(s.id);
        toast('Расчёт удалён');
      }
    },
  },
  h('div.item__icon', null, '🤝'),
  h('div.item__body', null,
    h('div.item__title', null, `${from} → ${to}`),
    h('div.item__sub', null, formatDate(s.date))),
  h('div.item__amount.num', null,
    h('b', null, formatMoney(s.amount, s.currency)),
    s.currency !== state.trip.homeCurrency
      ? h('span', null, formatMoney(s.amountHome, state.trip.homeCurrency)) : null));
}

/* ----------------------------------------------------------- запись расчёта */

export function openSettleSheet(plan) {
  const state = store.getState();
  const home = state.trip.homeCurrency;
  const t = plan.transfers[0];
  const accounts = alive(state.accounts);

  const d = {
    fromPersonId: t.fromPersonId,
    toPersonId: t.toPersonId,
    currency: home,
    amountText: formatAmount(t.amount, home),
    rateText: '1',
    date: todayISO(),
    fromAccountId: '',
    toAccountId: '',
  };

  sheet('Записать расчёт', (close) => {
    const errBox = h('div');
    const body = h('div');
    const redraw = () => { clear(body); mount(body, form()); };

    function form() {
      const isHome = d.currency === home;
      const accOpts = (personId) => [
        { value: '', label: 'не указывать' },
        ...accounts.filter((a) => a.ownerId === personId && a.currency === d.currency)
          .map((a) => ({ value: a.id, label: a.name })),
      ];

      return [
        h('p.muted', null,
          `${byId(state.people, d.fromPersonId)?.name} \u2192 ${byId(state.people, d.toPersonId)?.name}. `
          + 'Запись закроет долг; на «потрачено за поездку» она не повлияет.'),

        h('div.amount-input', null,
          amountInput(d.amountText, { oninput: (e) => { d.amountText = e.target.value; refresh(); } }),
          select(currencyChoices(state), d.currency, (e) => {
            d.currency = e.target.value;
            d.rateText = d.currency === home ? '1' : (rateFor(state, d.currency) || '');
            if (d.currency !== home) {
              // Пересчитываем сумму долга в выбранную валюту по курсу поездки.
              const r = rateFor(state, d.currency);
              if (r) d.amountText = formatAmount(Math.round(t.amount / Number(r)), d.currency);
            } else {
              d.amountText = formatAmount(t.amount, home);
            }
            redraw();
          })),

        h('div#settle-home.field__hint'),

        !isHome ? field(`Курс ${d.currency} → ${home}`, amountInput(d.rateText, {
          placeholder: rateFor(state, d.currency) || '0',
          oninput: (e) => { d.rateText = e.target.value; refresh(); },
        }), { hint: 'Замораживается в этой записи.' }) : null,

        h('div.grid2', null,
          field('С какого счёта', select(accOpts(d.fromPersonId), d.fromAccountId,
            (e) => { d.fromAccountId = e.target.value; })),
          field('На какой счёт', select(accOpts(d.toPersonId), d.toAccountId,
            (e) => { d.toAccountId = e.target.value; }))),
        h('div.field__hint', null, 'Счета можно не указывать — тогда изменится только долг, а остатки останутся как есть.'),

        field('Дата', h('input.input', {
          type: 'date', value: d.date, oninput: (e) => { d.date = e.target.value; },
        })),
        errBox,
        h('div.sheet__actions', null,
          h('button.btn.btn--primary.btn--block', { type: 'button', onclick: save }, 'Записать')),
      ];
    }

    function refresh() {
      const box = body.querySelector('#settle-home');
      if (!box) return;
      const amount = parseAmount(d.amountText, d.currency);
      if (amount == null || d.currency === home) { box.textContent = ''; return; }
      const rate = d.rateText || rateFor(state, d.currency);
      box.textContent = rate
        ? `= ${formatMoney(convert(amount, d.currency, rate, home), home)}`
        : 'Курс не задан';
    }

    function save() {
      clear(errBox);
      const amount = parseAmount(d.amountText, d.currency);
      if (amount == null || amount <= 0) {
        errBox.append(h('div.notice.notice--danger', null, 'Введите сумму больше нуля'));
        return;
      }
      const rate = d.currency === home ? '1' : (d.rateText || rateFor(state, d.currency));
      if (!rate) {
        errBox.append(h('div.notice.notice--danger', null, `Не задан курс ${d.currency} → ${home}`));
        return;
      }
      store.addSettlement({
        date: d.date,
        fromPersonId: d.fromPersonId,
        toPersonId: d.toPersonId,
        currency: d.currency,
        amount,
        rate,
        amountHome: convert(amount, d.currency, rate, home),
        fromAccountId: d.fromAccountId || null,
        toAccountId: d.toAccountId || null,
      });
      close();
      toast('Расчёт записан');
    }

    redraw();
    setTimeout(refresh, 0);
    return body;
  });
}

function currencyChoices(state) {
  const used = new Set([state.trip.homeCurrency]);
  for (const a of alive(state.accounts)) used.add(a.currency);
  return [...used].map((c) => ({ value: c, label: c }));
}
