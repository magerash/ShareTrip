// ui.js — тонкий слой над DOM. Никаких фреймворков: состояние маленькое,
// экранов шесть, перерисовка целиком укладывается в миллисекунды.

/** Создаёт элемент. h('div.card', {onclick}, ...children) */
export function h(spec, props = null, ...children) {
  let tag = 'div';
  let cls = '';
  let id = '';
  const m = String(spec).match(/^([a-zA-Z0-9-]+)?((?:[.#][^.#]+)*)$/);
  if (m) {
    tag = m[1] || 'div';
    for (const part of (m[2] || '').match(/[.#][^.#]+/g) || []) {
      if (part[0] === '.') cls += `${cls ? ' ' : ''}${part.slice(1)}`;
      else id = part.slice(1);
    }
  }
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (id) el.id = id;

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className += `${el.className ? ' ' : ''}${v}`;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'form') {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/**
 * Безопасная вставка: пропускает null/false/undefined и разворачивает массивы.
 * Нативный `el.append(null)` вставляет ТЕКСТ «null» — именно так на экране
 * расчёта появлялись лишние «null». Условные потомки добавляем только так.
 */
export function mount(el, ...children) {
  append(el, children);
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Иконка из набора: минимальные штриховые SVG, чтобы не тащить шрифт. */
export function icon(name, size = 23) {
  const paths = {
    list: 'M4 7h16M4 12h16M4 17h10',
    wallet: 'M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zm13 4h3M3 8V7a2 2 0 0 1 2-2h10',
    scale: 'M12 4v16M6 8h12M6 8l-3 6a3 3 0 0 0 6 0L6 8zm12 0l-3 6a3 3 0 0 0 6 0l-3-6z',
    dots: 'M5 12h.01M12 12h.01M19 12h.01',
    back: 'M15 5l-7 7 7 7',
    close: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14',
    swap: 'M7 10l4-4 4 4M11 6v12M17 14l-4 4-4-4',
    check: 'M5 12l5 5L19 7',
    trash: 'M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13',
    edit: 'M4 20h4L19 9l-4-4L4 16v4z',
    rate: 'M4 18L9 9l4 5 3-4 4 8z',
    download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[name] || paths.dots);
  svg.append(p);
  return svg;
}

/**
 * Словесный знак ShareTrip.
 *
 * Именно текстом, а не картинкой: в логотипе бренда «Share» набрано тёмно-синим,
 * и на тёмной теме оно сливалось с фоном до нечитаемости. Текст берёт цвет из
 * токенов и потому верен в обеих темах, а заодно остаётся резким на любом
 * экране. Веб-шрифт сознательно не подключается: приложение обязано работать
 * без сети (D-004), а молча подставленный запасной шрифт — это худший вариант,
 * чем честный системный.
 */
export function wordmark(size = 34) {
  return h('span.wordmark', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: `${Math.round(size * 0.24)}px`,
    },
    'aria-label': 'ShareTrip',
  },
  h('img', {
    src: 'assets/symbol.png', alt: '', width: Math.round(size * 1.15), height: Math.round(size * 1.15),
    style: { display: 'block' },
  }),
  h('span', {
    'aria-hidden': 'true',
    style: {
      fontSize: `${size}px`,
      fontWeight: '800',
      letterSpacing: '-.025em',
      lineHeight: '1',
      whiteSpace: 'nowrap',
    },
  },
  h('span', { style: { color: 'var(--fg)' } }, 'Share'),
  h('span', { style: { color: 'var(--teal)' } }, 'Trip')));
}

/* -------------------------------------------------------------- шторка */

let openSheets = 0;

/**
 * Модальная шторка снизu. `render(close)` возвращает содержимое.
 * Закрывается кнопкой, тапом по фону и кнопкой «назад» браузера.
 */
export function sheet(title, render, { onClose } = {}) {
  const backdrop = h('div.sheet-backdrop', { role: 'dialog', 'aria-modal': 'true' });
  const body = h('div.sheet');
  let closed = false;

  const close = (result) => {
    if (closed) return;
    closed = true;
    openSheets -= 1;
    if (openSheets === 0) document.body.style.overflow = '';
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (history.state?.sheet) history.back();
    if (onClose) onClose(result);
  };

  const onPop = () => { closed || close(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const head = h('div.sheet__head', null,
    h('h2', null, title),
    h('button.btn.btn--ghost.btn--sm', {
      onclick: () => close(), 'aria-label': 'Закрыть', type: 'button',
    }, icon('close', 20)));

  mount(body, h('div.sheet__grip'), head);
  const content = render(close);
  mount(body, content);

  backdrop.append(body);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.body.append(backdrop);

  openSheets += 1;
  document.body.style.overflow = 'hidden';
  history.pushState({ sheet: true }, '');
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);

  // Фокус на первое поле — чтобы клавиатура открылась сразу.
  const first = body.querySelector('input:not([type=hidden]), textarea, select');
  if (first && !first.readOnly) setTimeout(() => { try { first.focus(); } catch { /* ok */ } }, 60);

  return { close, body };
}

/** Подтверждение. Возвращает Promise<boolean>. */
export function confirmSheet(title, message, { danger = false, okText = 'Удалить' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    sheet(title, (close) => [
      h('p.muted', null, message),
      h('div.sheet__actions', null,
        h('button.btn', { type: 'button', onclick: () => { answered = true; close(); resolve(false); } }, 'Отмена'),
        h(`button.btn.${danger ? 'btn--danger' : 'btn--primary'}`, {
          type: 'button',
          onclick: () => { answered = true; close(); resolve(true); },
        }, okText)),
    ], { onClose: () => { if (!answered) resolve(false); } });
  });
}

/* --------------------------------------------------------------- тост */

let toastTimer = null;
export function toast(message, ms = 2400) {
  clearTimeout(toastTimer);
  document.querySelector('.toast')?.remove();
  const el = h('div.toast', { role: 'status' }, message);
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), ms);
}

/* ------------------------------------------------------------ элементы */

export function field(label, control, { hint, error } = {}) {
  return h('label.field', null,
    h('span.field__label', null, label),
    control,
    hint && h('span.field__hint', null, hint),
    error && h('span.field__error', null, error));
}

/** Сегментированный переключатель. */
export function segmented(options, value, onChange) {
  const wrap = h('div.seg', { role: 'group' });
  for (const o of options) {
    wrap.append(h('button', {
      type: 'button',
      'aria-pressed': String(o.value === value),
      onclick: () => onChange(o.value),
    }, o.label));
  }
  return wrap;
}

/** Ряд чипов с одиночным выбором. */
export function chips(options, value, onChange) {
  const wrap = h('div.chips');
  for (const o of options) {
    wrap.append(h('button.chip', {
      type: 'button',
      'aria-pressed': String(o.value === value),
      onclick: () => onChange(o.value),
    }, o.icon ? h('span.chip__icon', null, o.icon) : null, o.label));
  }
  return wrap;
}

/** Числовое поле, подготовленное под планшетную клавиатуру. */
export function amountInput(value, { placeholder = '0', oninput, id } = {}) {
  return h('input.input', {
    type: 'text',
    inputMode: 'decimal',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: false,
    enterkeyhint: 'done',
    value: value || '',
    placeholder,
    id,
    oninput,
    onfocus: (e) => e.target.select(),
  });
}

export function select(options, value, onchange, props = {}) {
  const el = h('select.select', { onchange, ...props });
  for (const o of options) {
    el.append(h('option', { value: o.value, selected: o.value === value }, o.label));
  }
  el.value = value;
  return el;
}

/* ------------------------------------------------------------ форматы */

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export function formatDate(iso, { withYear = false } = {}) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return iso;
  const base = `${d} ${MONTHS[m - 1] || ''}`;
  return withYear ? `${base} ${y}` : base;
}

/** «Сегодня» / «Вчера» / «3 сентября, среда» — заголовок дня в ленте. */
export function formatDayHeader(iso) {
  const today = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const todayISO = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  const yest = new Date(today.getTime() - 86400000);
  const yestISO = `${yest.getFullYear()}-${p(yest.getMonth() + 1)}-${p(yest.getDate())}`;
  if (iso === todayISO) return 'Сегодня';
  if (iso === yestISO) return 'Вчера';
  const dt = new Date(`${iso}T00:00:00`);
  const wd = WEEKDAYS[dt.getDay()];
  return `${formatDate(iso)}, ${wd}`;
}

/** Склонение: 1 трата, 2 траты, 5 трат. */
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
