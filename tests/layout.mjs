// tests/layout.mjs — проверка вёрстки: до низа каждого экрана можно доскроллить.
//
//   node tests/layout.mjs
//
// Стережёт конкретный отказ (D-012): нижняя панель закреплена и закрывает конец
// списка, если запас под неё задан отступом у body, а внешняя оболочка задала
// body фиксированную высоту. Так и случилось в артефакте — последние 30–40 px
// контента были недостижимы на всех четырёх вкладках, при том что на обычной
// странице всё прокручивалось.
//
// Поэтому проверяются ДВА варианта страницы:
//   plain    — web/index.html, как на своём сервере и на VPS;
//   artifact — web/artifact.html внутри оболочки площадки, как на claude.ai.
// Оболочка собирается здесь же, в памяти: в web/ ей не место, туда попадает
// только то, что выкладывается.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../web');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

/** Оболочка площадки артефактов: свой doctype, head и сброс стилей. */
async function artifactWrapper() {
  const body = await readFile(join(ROOT, 'artifact.html'), 'utf-8');
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  :root { color-scheme: light;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px); }
  body { margin: 0; font: 14px system-ui, -apple-system, sans-serif; background: #fafaf9; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>
${body}
</body></html>`;
}

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '/plain') p = '/index.html';
    if (p === '/artifact') {
      const html = await artifactWrapper();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!(await stat(file)).isFile()) throw new Error('nf');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
  }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let browser;
try { browser = await chromium.launch({ executablePath: CHROME }); }
catch { browser = await chromium.launch(); }

const VIEWPORTS = [
  { name: 'телефон', width: 390, height: 740 },
  { name: 'узкий телефон', width: 360, height: 640 },
  { name: 'планшет', width: 840, height: 1180 },
  { name: 'планшет лёжа', width: 1180, height: 800 },
];
const MODES = ['plain', 'artifact'];
const TABS = ['Траты', 'Счета', 'Итог', 'Ещё'];

const failures = [];
let checks = 0;

for (const mode of MODES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: true, locale: 'ru-RU',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${base}/${mode}`, { waitUntil: 'networkidle' });
    await page.click('text=Создать поездку');
    await page.waitForSelector('.sheet');
    await page.fill('input[placeholder="Баку"]', 'Баку');
    await page.click('text=Поехали');
    await page.waitForSelector('.nav');

    // Набиваем данными так, чтобы контент заведомо не помещался в окно.
    await page.evaluate(async () => {
      const store = await import('./js/store.js');
      const s = store.getState();
      const [a, b] = s.people;
      for (let i = 0; i < 30; i += 1) {
        const amount = 10000 + i * 137;
        store.addExpense({
          date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
          title: `Трата номер ${i + 1}`,
          categoryId: s.categories[i % s.categories.length].id,
          currency: 'RUB', amount, rate: '1', amountHome: amount,
          payers: [{ accountId: s.accounts[0].id, personId: a.id, amount }],
          shares: [
            { personId: a.id, amount: Math.ceil(amount / 2) },
            { personId: b.id, amount: Math.floor(amount / 2) },
          ],
          splitMode: 'equal',
        });
      }
      for (let i = 0; i < 6; i += 1) {
        store.addAccount({
          name: `Счёт ${i + 1}`, ownerId: (i % 2 ? b : a).id,
          kind: i % 2 ? 'cash' : 'card', currency: 'RUB', opening: 100000,
        });
      }
    });
    await page.waitForTimeout(350);

    for (const tab of TABS) {
      await page.click(`.nav button:has-text("${tab}")`);
      await page.waitForTimeout(200);

      const r = await page.evaluate(() => new Promise((res) => {
        const doc = document.scrollingElement || document.documentElement;
        window.scrollTo(0, doc.scrollHeight);
        setTimeout(() => {
          const nav = document.querySelector('.nav');
          const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
          const view = document.querySelector('.view');
          const kids = view ? [...view.children] : [];
          const last = kids[kids.length - 1];
          res({
            navTop: Math.round(navTop),
            lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null,
            scrollHeight: doc.scrollHeight,
            clientHeight: doc.clientHeight,
            bodyHeight: getComputedStyle(document.body).height,
          });
        }, 300);
      }));

      checks += 1;
      const hidden = r.lastBottom == null ? null : r.lastBottom - r.navTop;
      const label = `${mode} · ${vp.name} ${vp.width}×${vp.height} · ${tab}`;

      if (hidden == null) {
        failures.push(`${label} — не нашёл контент`);
      } else if (hidden > 0) {
        failures.push(`${label} — под панелью осталось ${hidden} px (body height ${r.bodyHeight})`);
      }
    }

    if (errors.length) failures.push(`${mode} · ${vp.name} — ошибки: ${errors.join('; ')}`);
    await ctx.close();
  }
}

console.log('\n=== ПРОКРУТКА: доезжает ли контент до конца ===\n');
if (failures.length === 0) {
  console.log(`  ✓ ${checks} проверок: на всех вкладках, во всех размерах, в обоих вариантах`);
  console.log('    страницы нижняя панель ничего не закрывает.\n');
} else {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`\n  ${failures.length} из ${checks} проверок провалено\n`);
}

await browser.close();
server.close();
process.exit(failures.length ? 1 : 0);
