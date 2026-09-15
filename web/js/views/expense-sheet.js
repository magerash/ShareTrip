// views/expense-sheet.js — форма ввода траты.
// Цель: типовая трата за 2–3 касания. Всё редкое (курс, дата, название, заметка)
// свёрнуто; всё частое — на первом экране.

import * as store from '../store.js';
import {
  h, mount, clear, field, chips, segmented, sheet, toast, confirmSheet,
  amountInput, select, formatDate,
} from '../ui.js';
import {
  parseAmount, formatMoney, formatAmount, formatRate, convert,
  normalizeRate, remainder, sum,
} from '../money.js';
import {
  alive, byId, todayISO, shiftISO, rateFor, SPLIT, ACCOUNT_KINDS,
} from '../model.js';
import { buildShares, sharesWithPersonalItem, validateExpense } from '../split.js';
import { CURRENCY_OPTIONS } from '../currencies.js';

/* ------------------------------------------------------------ форма траты */

export function openExpenseSheet(expenseId = null) {
  const state = store.getState();
  const home = state.trip.homeCurrency;
  const people = alive(state.people);
  const accounts = alive(state.accounts);
  const existing = expenseId ? byId(state.expenses, expenseId) : null;

  const last = lastExpense(state);
  const d = existing ? fromExpense(existing, state) : {
    amountText: '',
    currency: last?.currency || home,
    categoryId: last?.categoryId || state.categories[0]?.id,
    title: '',
    date: todayISO(),
    payerMode: 'one',
    payerPersonId: people[0]?.id,
    payerAccountId: defaultAccount(state, people[0]?.id, last?.currency || home),
    payersMulti: {},
    chargedText: '',
    splitMode: SPLIT.EQUAL,
    excluded: {},
    exact: {},
    shares: Object.fromEntries(people.map((p) => [p.id, 1])),
    percent: Object.fromEntries(people.map((p) => [p.id, 50])),
    personalFor: null,
    personalText: '',
    rateText: rateFor(state, last?.currency || home) || '',
    note: '',
    refund: false,
  };

  sheet(existing ? 'Трата' : 'Новая трата', (close) => {
    const errBox = h('div');
    const body = h('div');

    const redraw = () => { clear(body); mount(body, buildForm()); };

    function amountMinor() {
      const raw = parseAmount(d.amountText, d.currency);
      if (raw == null) return null;
      return d.refund ? -Math.abs(raw) : raw;
    }

    function effectiveRate() {
      if (d.currency === home) return '1';
      return normalizeRate(d.rateText) || rateFor(state, d.currency);
    }

    function buildForm() {
      const total = amountMinor();
      const rate = effectiveRate();
      const homeAmount = (total != null && rate) ? convert(total, d.currency, rate, home) : null;

      /* --- 1. Сумма и валюта --- */
      const amountRow = h('div.amount-input', null,
        amountInput(d.amountText, {
          placeholder: '0',
          oninput: (e) => { d.amountText = e.target.value; refreshDerived(); },
        }),
        select(currencyChoices(state), d.currency, (e) => {
          d.currency = e.target.value;
          d.rateText = rateFor(state, d.currency) || '';
          d.payerAccountId = defaultAccount(state, d.payerPersonId, d.currency);
          redraw();
        }));

      const derived = h('div.field__hint');

      /* --- 1b. Когда: «Вчера», «Сегодня» и выбор даты ---------------------
         Раньше дата пряталась в свёрнутом блоке, и трату «за вчера» нельзя
         было завести, не раскрыв его. Теперь пресеты на виду, а обновляются
         точечно — иначе перерисовка забирала бы фокус у выбора даты. */
      const today = todayISO();
      const yesterday = shiftISO(today, -1);

      const chipYesterday = h('button.chip', {
        type: 'button',
        onclick: () => { d.date = yesterday; syncDate(); },
      }, 'Вчера');

      const chipToday = h('button.chip', {
        type: 'button',
        onclick: () => { d.date = today; syncDate(); },
      }, 'Сегодня');

      const dateInput = h('input.input.input--date', {
        type: 'date',
        value: d.date,
        'aria-label': 'Выбрать другую дату',
        onchange: (e) => { if (e.target.value) { d.date = e.target.value; syncDate(); } },
      });

      const dateHint = h('span.field__hint');

      function syncDate() {
        chipYesterday.setAttribute('aria-pressed', String(d.date === yesterday));
        chipToday.setAttribute('aria-pressed', String(d.date === today));
        if (dateInput.value !== d.date) dateInput.value = d.date;
        const custom = d.date !== today && d.date !== yesterday;
        dateHint.textContent = custom
          ? `${formatDate(d.date, { withYear: true })} — оплата до поездки тоже попадёт в расчёт`
          : '';
      }

      const dateField = h('div.field', null,
        h('span.field__label', null, 'Когда'),
        h('div.chips', null, chipYesterday, chipToday, dateInput),
        dateHint);
      syncDate();

      /* --- 2. Категория --- */
      const catChips = chips(
        alive(state.categories).map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
        d.categoryId,
        (v) => { d.categoryId = v; redraw(); },
      );

      /* --- 3. Кто платил --- */
      const payerChips = chips([
        ...people.map((p) => ({ value: p.id, label: p.name })),
        ...(kittyAccounts(state).length ? [{ value: 'kitty', label: 'Общая касса', icon: '🧺' }] : []),
        { value: 'multi', label: 'Двое', icon: '⊞' },
      ], d.payerMode === 'multi' ? 'multi' : (d.payerMode === 'kitty' ? 'kitty' : d.payerPersonId),
      (v) => {
        if (v === 'multi') { d.payerMode = 'multi'; initMulti(); }
        else if (v === 'kitty') {
          d.payerMode = 'kitty';
          d.payerAccountId = kittyAccounts(state)[0]?.id;
        } else {
          d.payerMode = 'one';
          d.payerPersonId = v;
          d.payerAccountId = defaultAccount(state, v, d.currency);
        }
        redraw();
      });

      function initMulti() {
        if (!Object.keys(d.payersMulti).length && total) {
          const half = Math.round(total / 2);
          d.payersMulti = { [people[0].id]: formatAmount(half, d.currency), [people[1].id]: formatAmount(total - half, d.currency) };
        }
      }

      const payerDetail = h('div');
      if (d.payerMode === 'one') {
        const opts = accountChoices(state, d.payerPersonId);
        payerDetail.append(field('С какого счёта',
          select(opts, d.payerAccountId, (e) => { d.payerAccountId = e.target.value; redraw(); }),
          { hint: accountHint(state, d.payerAccountId, d.currency) }));

        const acc = byId(state.accounts, d.payerAccountId);
        if (acc && acc.currency !== d.currency) {
          // Подставляем пересчёт по курсу траты, чтобы не блокировать быстрый ввод.
          // Курс карты почти всегда другой, поэтому просим сверить с выпиской.
          if (!d.chargedText && total != null && rate) {
            const guess = convert(total, d.currency, rate, acc.currency);
            d.chargedText = formatAmount(Math.abs(guess), acc.currency);
          }
          payerDetail.append(field(`Сколько списал банк, ${acc.currency}`,
            amountInput(d.chargedText, {
              oninput: (e) => { d.chargedText = e.target.value; refreshDerived(); },
            }),
            { hint: `Счёт в ${acc.currency}, а чек в ${d.currency}. Подставлен пересчёт по курсу траты — поправьте по выписке, если банк списал иначе. На долг это не влияет, только на остаток счёта.` }));
        }
      } else if (d.payerMode === 'kitty') {
        payerDetail.append(field('Из какой кассы',
          select(kittyAccounts(state).map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` })),
            d.payerAccountId, (e) => { d.payerAccountId = e.target.value; })));
      } else {
        for (const p of people) {
          payerDetail.append(field(`${p.name} внёс, ${d.currency}`,
            amountInput(d.payersMulti[p.id] || '', {
              oninput: (e) => { d.payersMulti[p.id] = e.target.value; refreshDerived(); },
            })));
        }
        payerDetail.append(h('div.field__hint#payers-left'));
      }

      /* --- 4. Как делить --- */
      const splitSeg = segmented([
        { value: SPLIT.EQUAL, label: 'Поровну' },
        { value: SPLIT.EXACT, label: 'Суммы' },
        { value: SPLIT.SHARES, label: 'Доли' },
        { value: SPLIT.PERCENT, label: '%' },
      ], d.splitMode, (v) => { d.splitMode = v; redraw(); });

      const splitDetail = h('div');
      if (d.splitMode === SPLIT.EQUAL) {
        splitDetail.append(h('div.chips', null, ...people.map((p) => h('button.chip', {
          type: 'button',
          'aria-pressed': String(!d.excluded[p.id]),
          onclick: () => { d.excluded[p.id] = !d.excluded[p.id]; redraw(); },
        }, d.excluded[p.id] ? '○' : '●', ` ${p.name}`))));
        splitDetail.append(h('div.field__hint', null,
          'Снимите галочку — трата станет личной и в долг не попадёт.'));

        splitDetail.append(h('details', { open: !!d.personalFor },
          h('summary.field__hint', { style: { cursor: 'pointer', padding: '8px 0' } },
            'Личная позиция на общем чеке'),
          h('div.grid2', null,
            field('Чья позиция', select(
              [{ value: '', label: 'нет' }, ...people.map((p) => ({ value: p.id, label: p.name }))],
              d.personalFor || '', (e) => { d.personalFor = e.target.value || null; refreshDerived(); })),
            field(`Сколько, ${d.currency}`, amountInput(d.personalText, {
              oninput: (e) => { d.personalText = e.target.value; refreshDerived(); },
            })))));
      } else if (d.splitMode === SPLIT.EXACT) {
        for (const p of people) {
          splitDetail.append(field(`${p.name}, ${d.currency}`,
            amountInput(d.exact[p.id] || '', {
              oninput: (e) => { d.exact[p.id] = e.target.value; refreshDerived(); },
            })));
        }
      } else if (d.splitMode === SPLIT.SHARES) {
        splitDetail.append(h('div.grid2', null, ...people.map((p) => field(`${p.name} — доли`,
          amountInput(String(d.shares[p.id] ?? 1), {
            oninput: (e) => { d.shares[p.id] = e.target.value; refreshDerived(); },
          })))));
      } else {
        splitDetail.append(h('div.grid2', null, ...people.map((p) => field(`${p.name}, %`,
          amountInput(String(d.percent[p.id] ?? 0), {
            oninput: (e) => { d.percent[p.id] = e.target.value; refreshDerived(); },
          })))));
      }
      splitDetail.append(h('div#split-left'));

      /* --- 4b. Название: подставляется из категории, но видно и правится --- */
      const titleField = field('Название', h('input.input', {
        type: 'text',
        value: d.title,
        placeholder: byId(state.categories, d.categoryId)?.name || 'Трата',
        oninput: (e) => { d.title = e.target.value; },
      }), { hint: 'Можно не заполнять — тогда возьмётся название категории.' });

      /* --- 5. Заметка --- */
      const noteField = field('Заметка', h('input.input', {
        type: 'text',
        value: d.note,
        placeholder: 'Необязательно',
        enterkeyhint: 'done',
        oninput: (e) => { d.note = e.target.value; },
      }));

      /* --- 6. Курс: только когда валюта не домашняя, и сразу на виду ---------
         Свёрнутого блока больше нет. После того как дата, заметка и название
         переехали наружу, в нём оставались курс и одна галочка — а прятать курс
         вредно: без него трата не сохраняется, и человек упирался в ошибку,
         которая отсылала его раскрывать блок (D-015). */
      const rateField = d.currency !== home
        ? field(`Курс ${d.currency} → ${home}`,
          amountInput(d.rateText, {
            placeholder: rateFor(state, d.currency) || '0',
            oninput: (e) => { d.rateText = e.target.value; refreshDerived(); },
          }),
          { hint: `Сколько ${home} за 1 ${d.currency}. Замораживается при сохранении — потом не пересчитается.` })
        : null;

      /* --- 7. Возврат или доход --- */
      const refundRow = h('label.switch-row', null,
        h('input', {
          type: 'checkbox', checked: d.refund,
          onchange: (e) => { d.refund = e.target.checked; refreshDerived(); },
        }),
        h('span.switch-row__label', null, 'Это возврат или доход',
          h('small', null, 'Возврат депозита, кэшбэк. Сумма учтётся со знаком минус.')));

      return [
        amountRow, derived,
        rateField,
        dateField,
        h('div.field', null, h('span.field__label', null, 'Категория'), catChips),
        titleField,
        h('div.field', null, h('span.field__label', null, 'Кто платил'), payerChips),
        payerDetail,
        h('div.field', null, h('span.field__label', null, 'Как делить'), splitSeg),
        splitDetail,
        noteField,
        refundRow,
        errBox,
        h('div.sheet__actions', null,
          existing ? h('button.btn.btn--danger', {
            type: 'button',
            onclick: async () => {
              if (await confirmSheet('Удалить трату?', 'Запись исчезнет из ленты и из расчёта. Историю можно посмотреть в журнале.', { danger: true })) {
                store.deleteExpense(existing.id);
                close();
                toast('Трата удалена');
              }
            },
          }, 'Удалить') : null,
          h('button.btn.btn--primary.btn--block', { type: 'button', onclick: save }, 'Сохранить')),
      ];
    }

    /** Пересчитывает подсказки без полной перерисовки — чтобы не терять фокус. */
    function refreshDerived() {
      const total = amountMinor();
      const rate = effectiveRate();
      const hint = body.querySelector('.field__hint');
      if (hint && hint.parentElement === body) {
        if (total == null) hint.textContent = '';
        else if (d.currency === home) hint.textContent = '';
        else if (!rate) hint.textContent = `Курс ${d.currency} → ${home} не задан — впишите его ниже.`;
        else {
          hint.textContent = `${formatMoney(convert(total, d.currency, rate, home), home)} · ${formatRate(rate, d.currency, home)}`;
        }
      }

      const left = body.querySelector('#split-left');
      if (left) {
        clear(left);
        if (total != null) {
          const shares = currentShares(total);
          const r = remainder(total, shares.map((s) => s.amount));
          if (r !== 0) {
            left.append(h('div.notice', null,
              `Осталось распределить: ${formatAmount(r, d.currency)} ${d.currency}`));
          }
        }
      }

      const pleft = body.querySelector('#payers-left');
      if (pleft && total != null && d.payerMode === 'multi') {
        const given = sum(people.map((p) => parseAmount(d.payersMulti[p.id] || '0', d.currency) || 0));
        const r = total - given;
        pleft.textContent = r === 0 ? 'Сходится с чеком.'
          : `Плательщики не сходятся с чеком на ${formatAmount(r, d.currency)} ${d.currency}`;
      }
    }

    function currentShares(total) {
      if (d.splitMode === SPLIT.EQUAL && d.personalFor) {
        const item = parseAmount(d.personalText, d.currency) || 0;
        if (item) return sharesWithPersonalItem(total, people, d.personalFor, item);
      }
      const input = {
        excluded: d.excluded,
        shares: mapNumbers(d.shares),
        percent: mapNumbers(d.percent),
        exact: Object.fromEntries(people.map((p) => [p.id, parseAmount(d.exact[p.id] || '0', d.currency) || 0])),
      };
      return buildShares(d.splitMode, total, people, input);
    }

    function mapNumbers(obj) {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        const n = Number(String(v).replace(',', '.'));
        out[k] = Number.isFinite(n) && n >= 0 ? n : 0;
      }
      return out;
    }

    function save() {
      clear(errBox);
      const total = amountMinor();
      const rate = effectiveRate();

      if (total == null) { fail('Введите сумму'); return; }
      if (!rate) { fail(`Не задан курс ${d.currency} → ${home}. Впишите его в поле «Курс» вверху формы.`); return; }

      const amountHome = convert(total, d.currency, rate, home);
      const shares = currentShares(total);

      let payers;
      if (d.payerMode === 'multi') {
        payers = people
          .map((p) => ({
            accountId: defaultAccount(state, p.id, d.currency),
            personId: p.id,
            amount: parseAmount(d.payersMulti[p.id] || '0', d.currency) || 0,
          }))
          .filter((p) => p.amount !== 0);
      } else if (d.payerMode === 'kitty') {
        payers = [{ accountId: d.payerAccountId, personId: null, amount: total }];
      } else {
        const acc = byId(state.accounts, d.payerAccountId);
        let charged = null;
        if (acc && acc.currency !== d.currency) {
          charged = parseAmount(d.chargedText, acc.currency);
          // Поле не заполнено — берём пересчёт по курсу траты. Остаток счёта
          // может разойтись с выпиской на курс карты, но ввод не блокируется.
          if (charged == null) charged = convert(total, d.currency, rate, acc.currency);
        }
        payers = [{
          accountId: d.payerAccountId,
          personId: d.payerPersonId,
          amount: total,
          ...(charged != null ? { chargedAmount: d.refund ? -Math.abs(charged) : charged } : {}),
        }];
      }

      const rec = {
        date: d.date,
        title: (d.title || '').trim() || byId(state.categories, d.categoryId)?.name || 'Трата',
        categoryId: d.categoryId,
        currency: d.currency,
        amount: total,
        rate,
        amountHome,
        payers,
        shares,
        splitMode: d.splitMode,
        note: (d.note || '').trim(),
      };

      const errs = validateExpense(rec, state);
      if (errs.length) { fail(errs.join('. ')); return; }

      if (existing) { store.updateExpense(existing.id, rec); toast('Сохранено'); }
      else { store.addExpense(rec); toast('Трата добавлена'); }

      // Курс, введённый руками, становится курсом поездки — чтобы не вводить дважды.
      if (d.currency !== home && normalizeRate(d.rateText) && normalizeRate(d.rateText) !== rateFor(state, d.currency)) {
        store.setRate(d.currency, d.rateText);
      }
      close();
    }

    function fail(msg) {
      errBox.append(h('div.notice.notice--danger', null, msg));
      errBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    redraw();
    setTimeout(refreshDerived, 0);
    return body;
  });
}

/* ------------------------------------------------------------ помощники */

function lastExpense(state) {
  const list = alive(state.expenses);
  return list.length ? list[list.length - 1] : null;
}

function kittyAccounts(state) {
  return alive(state.accounts).filter((a) => a.kind === ACCOUNT_KINDS.KITTY);
}

function currencyChoices(state) {
  const used = new Set([state.trip.homeCurrency]);
  for (const a of alive(state.accounts)) used.add(a.currency);
  for (const e of alive(state.expenses)) used.add(e.currency);
  const head = [...used].map((c) => ({ value: c, label: c }));
  const rest = CURRENCY_OPTIONS
    .filter((o) => !used.has(o.value))
    .map((o) => ({ value: o.value, label: o.value }));
  return [...head, ...rest];
}

function accountChoices(state, personId) {
  const list = alive(state.accounts)
    .filter((a) => a.ownerId === personId || a.kind === ACCOUNT_KINDS.KITTY);
  return list.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }));
}

function defaultAccount(state, personId, currency) {
  const own = alive(state.accounts).filter((a) => a.ownerId === personId);
  return (own.find((a) => a.currency === currency) || own[0])?.id
    || alive(state.accounts)[0]?.id;
}

function accountHint(state, accountId, currency) {
  const a = byId(state.accounts, accountId);
  if (!a) return '';
  if (a.currency === currency) return '';
  return `Счёт в ${a.currency}, чек в ${currency}.`;
}

function fromExpense(e, state) {
  const people = alive(state.people);
  const multi = e.payers.length > 1;
  const kitty = e.payers.length === 1 && e.payers[0].personId == null;
  return {
    amountText: formatAmount(Math.abs(e.amount), e.currency),
    currency: e.currency,
    categoryId: e.categoryId,
    title: e.title,
    date: e.date,
    payerMode: multi ? 'multi' : (kitty ? 'kitty' : 'one'),
    payerPersonId: e.payers[0]?.personId || people[0]?.id,
    payerAccountId: e.payers[0]?.accountId,
    payersMulti: Object.fromEntries(e.payers.filter((p) => p.personId)
      .map((p) => [p.personId, formatAmount(p.amount, e.currency)])),
    chargedText: e.payers[0]?.chargedAmount != null
      ? formatAmount(Math.abs(e.payers[0].chargedAmount), byId(state.accounts, e.payers[0].accountId)?.currency || e.currency)
      : '',
    splitMode: e.splitMode || SPLIT.EQUAL,
    excluded: Object.fromEntries(e.shares.map((s) => [s.personId, s.amount === 0])),
    exact: Object.fromEntries(e.shares.map((s) => [s.personId, formatAmount(s.amount, e.currency)])),
    shares: Object.fromEntries(people.map((p) => [p.id, 1])),
    percent: Object.fromEntries(people.map((p) => [p.id, 50])),
    personalFor: null,
    personalText: '',
    rateText: e.rate,
    note: e.note || '',
    refund: e.amount < 0,
  };
}
