// split.js — как делится чек и что считается корректной записью.
// Отделено от model.js (правило `.claude/rules/file-limits.md`): model.js отвечает за
// остатки и «кто кому должен», а здесь — построение долей и валидация ввода.

import { allocate, sum, decimalsOf } from './money.js';
import { SPLIT } from './model.js';

/* ----------------------------------------------------------- split builders */

/**
 * Строит доли по режиму деления. Возвращает суммы В ВАЛЮТЕ ТРАТЫ, целые,
 * в сумме дающие ровно `total`.
 */
export function buildShares(mode, total, people, input = {}) {
  const ids = people.map((p) => p.id);
  switch (mode) {
    case SPLIT.EXACT: {
      const parts = ids.map((id) => input.exact?.[id] || 0);
      return ids.map((id, i) => ({ personId: id, amount: parts[i] }));
    }
    case SPLIT.SHARES: {
      const w = ids.map((id) => Number(input.shares?.[id] ?? 1));
      const parts = allocate(total, w.map((x) => (Number.isFinite(x) && x >= 0 ? x : 0)));
      return ids.map((id, i) => ({ personId: id, amount: parts[i] }));
    }
    case SPLIT.PERCENT: {
      const w = ids.map((id) => Number(input.percent?.[id] ?? 0));
      const parts = allocate(total, w.map((x) => (Number.isFinite(x) && x >= 0 ? x : 0)));
      return ids.map((id, i) => ({ personId: id, amount: parts[i] }));
    }
    case SPLIT.EQUAL:
    default: {
      // Исключённые участники получают нулевой вес — это «личная позиция».
      const w = ids.map((id) => (input.excluded?.[id] ? 0 : 1));
      const parts = allocate(total, w);
      return ids.map((id, i) => ({ personId: id, amount: parts[i] }));
    }
  }
}

/**
 * Помощник «личная позиция на общем чеке»: из общего чека вычитается позиция
 * одного человека, остаток делится поровну. Ужин, где вино пил один.
 */
export function sharesWithPersonalItem(total, people, personId, itemAmount) {
  const rest = total - itemAmount;
  const equal = allocate(rest, people.map(() => 1));
  return people.map((p, i) => ({
    personId: p.id,
    amount: equal[i] + (p.id === personId ? itemAmount : 0),
  }));
}

/* ------------------------------------------------------------- validation */

/** Проверяет трату перед сохранением. Возвращает массив человеческих ошибок. */
export function validateExpense(e, state) {
  const errs = [];
  const dec = decimalsOf(e.currency);
  if (!Number.isInteger(e.amount)) errs.push('Сумма должна быть целым числом минорных единиц');
  if (e.amount === 0) errs.push('Сумма не может быть нулевой');
  if (!e.payers?.length) errs.push('Укажите хотя бы одного плательщика');
  if (!e.shares?.length) errs.push('Укажите, как делить');

  const paidSum = sum(e.payers.map((p) => p.amount));
  if (paidSum !== e.amount) {
    errs.push(`Плательщики внесли ${paidSum / 10 ** dec}, а чек на ${e.amount / 10 ** dec}`);
  }
  const shareSum = sum(e.shares.map((s) => s.amount));
  if (shareSum !== e.amount) {
    const left = (e.amount - shareSum) / 10 ** dec;
    errs.push(`Осталось распределить: ${left}`);
  }
  if (!e.rate) errs.push(`Не задан курс ${e.currency} → ${state.trip.homeCurrency}`);
  return errs;
}

export function validateTransfer(t, state) {
  const errs = [];
  if (!t.fromAccountId || !t.toAccountId) errs.push('Выберите оба счёта');
  if (t.fromAccountId === t.toAccountId) errs.push('Счета должны быть разными');
  if (!t.amountOut) errs.push('Укажите, сколько ушло');
  if (!t.amountIn) errs.push('Укажите, сколько пришло');
  return errs;
}
