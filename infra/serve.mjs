// infra/serve.mjs — статический сервер для ShareTrip.
//
//   node infra/serve.mjs                 → http://localhost:8080, только этот компьютер
//   node infra/serve.mjs --host 0.0.0.0  → видно с телефона в той же сети
//   node infra/serve.mjs --port 9000
//
// Ноль зависимостей, только стандартная библиотека Node. Работает одинаково на
// Windows, Linux и macOS. Нужен потому, что открыть web/index.html двойным кликом
// нельзя: браузер запрещает ES-модули и IndexedDB на схеме file://.
//
// Это сервер для разработки и домашней сети. На VPS файлы отдаёт Caddy —
// см. docs/deploy.md.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../web');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(flag('port', process.env.PORT || 8080));
const HOST = flag('host', process.env.HOST || '127.0.0.1');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (urlPath === '/') urlPath = '/index.html';

  // Защита от выхода за пределы web/: нормализуем и проверяем префикс.
  const target = resolve(join(ROOT, normalize(urlPath)));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      // Приложение меняется при каждой правке — кэш только мешает разработке.
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 — такого файла нет');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Порт ${PORT} уже занят. Возьмите другой:\n`);
    console.error(`      node infra/serve.mjs --port ${PORT + 1}\n`);
  } else {
    console.error(`\n  Не удалось запустить сервер: ${err.message}\n`);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log('\n  ShareTrip\n');
  console.log(`  Папка:    ${ROOT}`);
  console.log(`  Открыть:  http://localhost:${PORT}`);

  if (HOST === '0.0.0.0') {
    for (const list of Object.values(networkInterfaces())) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  С телефона: http://${net.address}:${PORT}`);
        }
      }
    }
    console.log('\n  Внимание: данные у каждого устройства свои — см. docs/deploy.md,');
    console.log('  раздел «Почему общий адрес ещё не значит общие данные».');
  } else {
    console.log('\n  Чтобы открыть с телефона в той же сети:');
    console.log('      node infra/serve.mjs --host 0.0.0.0');
  }

  console.log('\n  Остановить — Ctrl+C\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => process.exit(0)); });
}
