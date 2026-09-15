// tests/smoke.mjs — живая проверка приложения в настоящем браузере.
//
//   npm install playwright      # один раз; браузер уже стоит, `playwright install` не нужен
//   node tests/smoke.mjs
//
// Поднимает статический сервер на случайном порту, открывает Chromium окном 840×1180
// (планшет в портрете) и проходит сценарий целиком: поездка → счёт в AZN → обмен →
// трата картой партнёра → итог → перезагрузка → расчёт → CSV. Снимки экрана кладёт
// в .shots/ (каталог в .gitignore).
//
// Этот скрипт нашёл два настоящих бага: потерю последней операции при отложенном
// сохранении (D-008) и текстовые узлы «null» от нативного append. Обе регрессии он
// теперь стережёт.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../web');
const SHOTS = process.env.SHOT_DIR || resolve(HERE, '../.shots');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const s = await stat(file);
    if (!s.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// Путь к Chromium: в этом окружении браузеры предустановлены, иначе — обычный поиск.
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME });
} catch {
  browser = await chromium.launch();
}
mkdirSync(SHOTS, { recursive: true });
// Планшет Huawei MatePad 11.5 — 1920x1200 логически ~ 840x1260 CSS px в портрете.
const ctx = await browser.newContext({
  viewport: { width: 840, height: 1180 },
  deviceScaleFactor: 2,
  hasTouch: true,
  locale: 'ru-RU',
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

const steps = [];
const ok = (name) => { steps.push(`  ✓ ${name}`); };
const fail = (name, detail) => { steps.push(`  ✗ ${name} — ${detail}`); };

async function expectNoNull(label) {
  const stray = await page.evaluate(() => {
    const bad = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) {
      const t = walk.currentNode.nodeValue.trim();
      if (t === 'null' || t === 'undefined') {
        bad.push(walk.currentNode.parentElement?.className || '?');
      }
    }
    return bad;
  });
  if (stray.length === 0) ok(label);
  else fail(label, `лишние узлы в: ${stray.join(', ')}`);
}

async function expectText(re, label) {
  const body = await page.textContent('body');
  if (re.test(body)) ok(label);
  else fail(label, `не нашёл ${re} в тексте`);
  return body;
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });

  /* --- 1. Первый запуск --- */
  await page.waitForSelector('text=Создать поездку', { timeout: 8000 });
  ok('стартовый экран отрисовался');

  await page.click('text=Создать поездку');
  await page.waitForSelector('.sheet', { timeout: 4000 });
  await page.fill('input[placeholder="Баку"]', 'Баку');
  await page.fill('input[placeholder="Ксюша"]', 'Ксюша');
  await page.fill('input[placeholder="Вова"]', 'Вова');
  await page.click('text=Поехали');
  await page.waitForSelector('.nav', { timeout: 4000 });
  ok('поездка создана, появилась навигация');

  /* --- 2. Счета: наличные AZN для обоих + обмен --- */
  await page.click('.nav button:has-text("Счета")');
  await page.waitForSelector('text=На руках');
  ok('экран счетов открылся');

  // Новый счёт: наличные AZN Ани
  await page.click('button:has-text("Новый счёт")');
  await page.waitForSelector('.sheet');
  await page.click('.seg button:has-text("Наличные")');
  await page.fill('input[placeholder="Наличные манаты"]', 'Наличные Ксюши');
  await page.selectOption('.sheet select >> nth=1', 'AZN');
  await page.click('.sheet__actions button:has-text("Сохранить")');
  await page.waitForSelector('.sheet', { state: 'detached', timeout: 4000 });
  await expectText(/Наличные Ксюши/, 'счёт «Наличные Ксюши» создан');

  // Обмен: 20 000 ₽ -> 412 AZN
  await page.click('button:has-text("Перевод / обмен")');
  await page.waitForSelector('.sheet');
  const selects = page.locator('.sheet select');
  await selects.nth(0).selectOption({ index: 0 });   // Карта · Ксюша
  await selects.nth(1).selectOption({ index: 2 });   // Наличные Ксюши
  await page.fill('.sheet input[inputmode="decimal"] >> nth=0', '20000');
  await page.fill('.sheet input[inputmode="decimal"] >> nth=1', '412');
  await page.waitForTimeout(150);
  const implied = await page.textContent('#implied');
  if (/48[,.]54/.test(implied)) ok(`фактический курс выведен: ${implied.trim().slice(0, 60)}`);
  else fail('фактический курс', implied);
  await page.click('.sheet__actions button:has-text("Сохранить")');
  await page.waitForSelector('.sheet', { state: 'detached', timeout: 4000 });
  await expectText(/412,00/, 'остаток 412 AZN на счету');

  /* --- 3. Трата в AZN, платит Вова, делим поровну --- */
  await page.click('.nav button:has-text("Траты")');
  await page.click('.fab');
  await page.waitForSelector('.sheet');
  await page.fill('.sheet input[inputmode="decimal"] >> nth=0', '84,50');
  await page.selectOption('.sheet select >> nth=0', 'AZN');
  await page.waitForTimeout(120);
  await page.click('.sheet .chip:has-text("Еда")');
  await page.click('.sheet .chip:has-text("Вова")');
  await page.waitForTimeout(120);
  await page.click('.sheet__actions button:has-text("Сохранить")');
  await page.waitForSelector('.sheet', { state: 'detached', timeout: 4000 });
  await expectText(/Еда/, 'трата попала в ленту');
  await expectText(/4 101,94|4 101,94/, 'сумма пересчитана в рубли по замороженному курсу');

  /* --- 4. Итог --- */
  await page.click('.nav button:has-text("Итог")');
  await page.waitForSelector('.verdict');
  const verdict = await page.textContent('.verdict');
  if (/Ксюша/.test(verdict) && /2 050,97|2 050,97/.test(verdict)) {
    ok(`приговор верен: ${verdict.replace(/\s+/g, ' ').trim()}`);
  } else {
    fail('приговор', verdict.replace(/\s+/g, ' ').trim());
  }
  await expectText(/Откуда взялась эта цифра/, 'разбивка показана');

  /* --- 5. Перезагрузка: данные на месте --- */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.nav', { timeout: 6000 });
  await expectText(/Баку/, 'после перезагрузки поездка загрузилась из IndexedDB');
  await page.click('.nav button:has-text("Итог")');
  await page.waitForSelector('.verdict');
  const v2 = await page.textContent('.verdict');
  if (/2 050,97|2 050,97/.test(v2)) ok('итог сохранился после перезагрузки');
  else fail('итог после перезагрузки', v2.replace(/\s+/g, ' ').trim());

  /* --- 6. Запись расчёта закрывает долг --- */
  await page.click('button:has-text("Записать расчёт")');
  await page.waitForSelector('.sheet');
  await page.click('.sheet__actions button:has-text("Записать")');
  await page.waitForSelector('.sheet', { state: 'detached', timeout: 4000 });
  await expectText(/Всё рассчитано/, 'после расчёта долгов нет');

  /* --- 7. CSV выгружается --- */
  await page.click('.nav button:has-text("Ещё")');
  await page.waitForSelector('text=Курсы валют');
  const dl = page.waitForEvent('download', { timeout: 6000 });
  await page.click('button:has-text("CSV — всё")');
  const file = await dl;
  ok(`CSV выгружен: ${file.suggestedFilename()}`);

  /* --- 7b. Ни одного «null» в разметке на всех вкладках --- */
  for (const tab of ['Траты', 'Счета', 'Итог', 'Ещё']) {
    await page.click(`.nav button:has-text("${tab}")`);
    await page.waitForTimeout(150);
    await expectNoNull(`вкладка «${tab}» без лишних null`);
  }

  /* --- 7c. Грамматика: никаких «должен/должна» по имени --- */
  await page.click('.nav button:has-text("Итог")');
  await page.waitForTimeout(150);
  const settleText = await page.textContent('.view');
  if (/\b(должен|должна)\s+[А-ЯЁ]/.test(settleText)) {
    fail('грамматика', 'осталось «должен/должна» перед именем');
  } else ok('грамматика: род по имени не угадывается');

  /* --- 8. Тёмная тема не ломает вёрстку --- */
  await ctx2Check(page);

  /* --- 9. Скриншоты --- */
  await page.click('.nav button:has-text("Траты")');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/shot-expenses.png`, fullPage: false });
  await page.click('.nav button:has-text("Итог")');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/shot-settle.png`, fullPage: false });
  await page.click('.nav button:has-text("Счета")');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/shot-accounts.png`, fullPage: false });
  ok('скриншоты сняты');
} catch (e) {
  fail('сценарий прерван', e.message);
}

async function ctx2Check(p) {
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForTimeout(200);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(242, 247, 251)') ok(`тёмная тема применилась (${bg})`);
  else fail('тёмная тема', bg);
  await p.emulateMedia({ colorScheme: 'light' });
}

console.log('\n=== ЖИВАЯ ПРОВЕРКА В БРАУЗЕРЕ ===');
console.log(steps.join('\n'));
if (errors.length) {
  console.log('\n=== ОШИБКИ В КОНСОЛИ ===');
  console.log([...new Set(errors)].slice(0, 20).join('\n'));
}
const failed = steps.filter((s) => s.includes('✗')).length;
console.log(`\nИтог: ${steps.length - failed} успешно, ${failed} провалено, ${errors.length} ошибок в консоли`);

await browser.close();
server.close();
process.exit(failed || errors.length ? 1 : 0);
