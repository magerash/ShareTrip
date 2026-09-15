// views/expenses.js — лента трат: итоги поездки и список по дням.
// Форма ввода живёт в expense-sheet.js (правило `.claude/rules/file-limits.md`).

import { h, formatDayHeader, plural } from '../ui.js';
import { formatMoney } from '../money.js';
import { alive, byId, homeShares, tripTotals, rateFor, SPLIT } from '../model.js';
import { openExpenseSheet } from './expense-sheet.js';

export { openExpenseSheet };

/* --------------------------------------------------------------- лента */

export function renderExpenses(state) {
  const home = state.trip.homeCurrency;
  const totals = tripTotals(state);
  const list = alive(state.expenses).slice()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const out = [renderHero(state, totals)];

  const missing = missingRateCurrencies(state);
  if (missing.length) {
    out.push(h('div.notice', null, h('span', null,
      h('b', null, 'Не задан курс: '), missing.join(', '), '. ',
      h('button.btn.btn--sm.btn--ghost', {
        type: 'button', onclick: () => import('./more.js').then((m) => m.openRatesSheet()),
      }, 'Задать курс'))));
  }

  if (!list.length) {
    out.push(h('div.empty', null,
      h('div.empty__icon', null, '🧾'),
      h('p', null, 'Пока ни одной траты.'),
      h('p.small', null, 'Нажмите «+» — сумма, категория, сохранить.')));
    return out;
  }

  const feed = h('div.list');
  let day = null;
  for (const e of list) {
    if (e.date !== day) {
      day = e.date;
      const dayTotal = list.filter((x) => x.date === day).reduce((a, x) => a + x.amountHome, 0);
      feed.append(h('div.list__day', null,
        h('span', null, formatDayHeader(day)),
        h('span.spacer'),
        h('span.num', null, formatMoney(dayTotal, home))));
    }
    feed.append(renderExpenseItem(state, e));
  }
  out.push(feed);
  return out;
}

function renderHero(state, totals) {
  const home = state.trip.homeCurrency;
  const budget = state.trip.dailyBudget || 0;
  return h('div.card.hero', null,
    h('div.hero__label', null, 'Потрачено за поездку'),
    h('div.hero__value.num', null, formatMoney(totals.spent, home)),
    h('div.hero__grid', null,
      h('div', null,
        h('b.num', null, formatMoney(totals.perDay, home)),
        h('span', null, 'в день в среднем')),
      h('div', null,
        h('b.num', null, String(totals.days)),
        h('span', null, plural(totals.days, 'день', 'дня', 'дней'))),
      h('div', null,
        h('b.num', null, String(totals.count)),
        h('span', null, plural(totals.count, 'трата', 'траты', 'трат'))),
      budget > 0 ? h('div', null,
        h('b.num', null, formatMoney(budget - totals.perDay, home)),
        h('span', null, (budget - totals.perDay) >= 0 ? 'в день в запасе' : 'перерасход в день')) : null),
  );
}

function renderExpenseItem(state, e) {
  const home = state.trip.homeCurrency;
  const cat = byId(state.categories, e.categoryId);
  const payers = e.payers.map((p) => (p.personId
    ? (byId(state.people, p.personId)?.name || '?')
    : 'касса')).join(' + ');
  const shares = homeShares(e);
  const split = describeSplit(state, e, shares);

  return h('button.item', {
    type: 'button',
    onclick: () => openExpenseSheet(e.id),
  },
  h('div.item__icon', null, cat?.icon || '•'),
  h('div.item__body', null,
    h('div.item__title', null, e.title || cat?.name || 'Трата'),
    h('div.item__sub', null, `${payers} · ${split}`)),
  h('div.item__amount.num', null,
    h('b', { class: e.amount < 0 ? 'pos' : '' }, formatMoney(e.amountHome, home)),
    e.currency !== home ? h('span', null, formatMoney(e.amount, e.currency)) : null));
}

function describeSplit(state, e, shares) {
  const people = alive(state.people);
  if (people.length === 2) {
    const zero = shares.filter((s) => s.amount === 0);
    if (zero.length === 1) {
      const who = people.find((p) => p.id === shares.find((s) => s.amount !== 0)?.personId);
      return `лично: ${who?.name || '?'}`;
    }
    const [a, b] = shares;
    if (a && b && Math.abs(a.amount - b.amount) <= 1) return 'поровну';
  }
  return SPLIT_LABEL[e.splitMode] || 'делится';
}

const SPLIT_LABEL = {
  [SPLIT.EQUAL]: 'поровну',
  [SPLIT.EXACT]: 'точные суммы',
  [SPLIT.SHARES]: 'доли',
  [SPLIT.PERCENT]: 'проценты',
};

function missingRateCurrencies(state) {
  const home = state.trip.homeCurrency;
  const need = new Set();
  for (const a of alive(state.accounts)) if (a.currency !== home) need.add(a.currency);
  for (const e of alive(state.expenses)) if (e.currency !== home) need.add(e.currency);
  return [...need].filter((c) => !rateFor(state, c));
}
