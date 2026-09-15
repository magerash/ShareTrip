// tests/form.mjs — форма траты: что на виду и что сохраняется.
//
//   node tests/form.mjs
//
// Стережёт требование, ради которого форму переделывали: дата и заметка должны
// быть видны СРАЗУ, без раскрытия свёрнутого блока. Раньше трату «за вчера»
// нельзя было завести, не развернув «Курс, дата, название», — это два лишних
// касания на действие, которое случается каждый день.
//
// Проверяется и то, что пресеты и поле даты согласованы между собой: нажал
// «Вчера» — поле показывает вчерашнее число; выбрал своё — пресеты погасли.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../web');
const SHOTS = process.env.SHOT_DIR || resolve(HERE, '../.shots');
const T = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json' };
const srv = createServer(async (rq,rs)=>{try{let p=decodeURIComponent(rq.url.split('?')[0]);if(p==='/')p='/index.html';
const f=join(ROOT,normalize(p).replace(/^(\.\.[/\\])+/,''));if(!(await stat(f)).isFile())throw 0;
rs.writeHead(200,{'content-type':T[extname(f)]||'application/octet-stream'});rs.end(await readFile(f));}catch{rs.writeHead(404);rs.end('404');}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${srv.address().port}`;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let b;
try { b = await chromium.launch({ executablePath: CHROME }); }
catch { b = await chromium.launch(); }
await mkdir(SHOTS, { recursive: true });
const ctx = await b.newContext({ viewport:{width:840,height:1180}, hasTouch:true, locale:'ru-RU', deviceScaleFactor:2 });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});

const ok=[],bad=[];
const check=(c,l,d='')=>{(c?ok:bad).push(l+(c?'':` — ${d}`));};

await page.goto(base,{waitUntil:'networkidle'});
await page.click('text=Создать поездку');
await page.waitForSelector('.sheet');
await page.fill('input[placeholder="Баку"]','Баку');
await page.click('text=Поехали');
await page.waitForSelector('.nav');

await page.click('.fab');
await page.waitForSelector('.sheet');

// 1. Дата, название и заметка видны сразу, без раскрытия чего-либо.
const summaries = await page.$$eval('.sheet summary', els => els.map(e => e.textContent.trim()));
check(!summaries.some(t => /курс|назван|возврат/i.test(t)),
  'свёрнутого блока «курс/название/возврат» больше нет', summaries.join(' | '));

check(await page.isVisible('.sheet .chip:has-text("Сегодня")'), 'чип «Сегодня» виден');
check(await page.isVisible('.sheet .chip:has-text("Вчера")'), 'чип «Вчера» виден');
check(await page.isVisible('.sheet input[type=date]'), 'выбор даты виден');
check(await page.isVisible('.sheet input[placeholder="Необязательно"]'), 'заметка видна');
check(await page.isVisible('.sheet input[placeholder="Еда"], .sheet input[placeholder="Жильё"]')
   || await page.isVisible('.sheet .field:has-text("НАЗВАНИЕ") input'), 'название видно');
check(await page.isVisible('.sheet .switch-row:has-text("возврат")'), 'отметка «возврат» видна');

// 2. По умолчанию выбрано «Сегодня».
const pressedToday = await page.getAttribute('.sheet .chip:has-text("Сегодня")','aria-pressed');
check(pressedToday === 'true', 'по умолчанию отмечено «Сегодня»', `aria-pressed=${pressedToday}`);

// 3. Нажатие «Вчера» переключает и чип, и поле даты.
await page.click('.sheet .chip:has-text("Вчера")');
await page.waitForTimeout(120);
const py = await page.getAttribute('.sheet .chip:has-text("Вчера")','aria-pressed');
const pt = await page.getAttribute('.sheet .chip:has-text("Сегодня")','aria-pressed');
const dv = await page.inputValue('.sheet input[type=date]');
const expected = new Date(Date.now()-86400000).toISOString().slice(0,10);
check(py==='true' && pt==='false', 'после «Вчера» отмечен только он', `вчера=${py} сегодня=${pt}`);
check(dv===expected, 'поле даты показывает вчерашнее число', `${dv} вместо ${expected}`);

// 4. Произвольная дата: чипы гаснут, появляется подсказка.
await page.fill('.sheet input[type=date]','2026-08-10');
await page.waitForTimeout(150);
const py2 = await page.getAttribute('.sheet .chip:has-text("Вчера")','aria-pressed');
const hint = await page.textContent('.sheet .field:has(input[type=date]) .field__hint');
check(py2==='false','при своей дате пресеты сняты',`вчера=${py2}`);
check(/10 августа 2026/.test(hint||''),'подсказка называет выбранную дату',`«${(hint||'').trim()}»`);

// 4b. Название: плейсхолдер идёт за категорией, значение сохраняется.
await page.click('.sheet .chip:has-text("Жильё")');
await page.waitForTimeout(120);
const ph = await page.getAttribute('.sheet .field:has(span:text("НАЗВАНИЕ")) input', 'placeholder');
check(ph === 'Жильё', 'плейсхолдер названия идёт за категорией', `«${ph}»`);

// 4c. Курс появляется сам, когда валюта не домашняя.
await page.selectOption('.sheet select >> nth=0', 'AZN');
await page.waitForTimeout(150);
const rateVisible = await page.isVisible('.sheet .field:has-text("КУРС AZN") input');
check(rateVisible, 'поле курса показано сразу для чужой валюты');
await page.selectOption('.sheet select >> nth=0', 'RUB');
await page.waitForTimeout(150);
const rateGone = await page.isVisible('.sheet .field:has-text("КУРС") input');
check(!rateGone, 'для домашней валюты поля курса нет', `видно=${rateGone}`);

// 4d. Форма стала длинной — последний её элемент обязан быть достижим.
//     Ждём, пока шторка сфокусирует первое поле: браузер возвращает прокрутку
//     наверх ПОСЛЕ фокуса, и замер до этого момента меряет не то.
await page.waitForTimeout(600);
const reach = await page.evaluate(() => new Promise((res) => {
  const sheet = document.querySelector('.sheet');
  sheet.scrollTop = sheet.scrollHeight;
  setTimeout(() => {
    const actions = document.querySelector('.sheet__actions');
    const last = document.querySelector('.sheet .switch-row');
    res({
      overlap: Math.round(last.getBoundingClientRect().bottom - actions.getBoundingClientRect().top),
      atEnd: Math.abs(sheet.scrollTop - (sheet.scrollHeight - sheet.clientHeight)) < 2,
    });
  }, 350);
}));
check(reach.atEnd && reach.overlap <= 0,
  'низ формы достижим: панель действий его не закрывает',
  `перекрытие ${reach.overlap} px, доскроллено=${reach.atEnd}`);

// 5. Сохранение с этой датой и заметкой.
await page.fill('.sheet input[inputmode="decimal"] >> nth=0','1500');
await page.fill('.sheet input[placeholder="Необязательно"]','ужин у моря');
await page.click('.sheet__actions button:has-text("Сохранить")');
await page.waitForSelector('.sheet',{state:'detached',timeout:5000});

const saved = await page.evaluate(async()=>{const s=await import('./js/store.js');const e=s.getState().expenses[0];return {date:e.date,note:e.note,amount:e.amount};});
check(saved.date==='2026-08-10','дата сохранилась как выбрана',JSON.stringify(saved));
check(saved.note==='ужин у моря','заметка сохранилась',JSON.stringify(saved));

// 6. Правка: открываем трату заново — дата и заметка на месте и видны.
await page.click('.item');
await page.waitForSelector('.sheet');
const dv2 = await page.inputValue('.sheet input[type=date]');
const nv2 = await page.inputValue('.sheet input[placeholder="Необязательно"]');
check(dv2==='2026-08-10','при правке дата подставлена',dv2);
check(nv2==='ужин у моря','при правке заметка подставлена',nv2);

console.log('\n=== ФОРМА ТРАТЫ: ДАТА И ЗАМЕТКА ===');
for(const l of ok) console.log('  ✓ '+l);
for(const l of bad) console.log('  ✗ '+l);
if(errs.length) console.log('\nОшибки в консоли:\n  '+[...new Set(errs)].join('\n  '));
console.log(`\nИтог: ${ok.length} успешно, ${bad.length} провалено, ${errs.length} ошибок`);

await page.screenshot({ path: `${SHOTS}/shot-form.png` });
await b.close(); srv.close();
process.exit(bad.length||errs.length?1:0);
