// tools/wiki/py.mjs — запускает скрипт вики тем Python, который есть на машине.
//
//   node tools/wiki/py.mjs wiki-doctor.py [аргументы]
//
// Нужен из-за Windows: там `python3` — это шим из Microsoft Store, который
// ничего не выполняет (в лучшем случае открывает Store). Скрипты и хуки,
// написанные как `python3 ...`, на домашнем компьютере молча не работали бы —
// включая гейт, который не пускает коммит с красной вики. Node есть всегда:
// на нём гоняются тесты.
//
// Порядок кандидатов: `py -3` (штатный лаунчер Windows), затем `python3`,
// затем `python`. Первый, который отвечает на `--version`, и запускает скрипт.

import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));

const [scriptName, ...rest] = process.argv.slice(2);
if (!scriptName) {
  console.error('Использование: node tools/wiki/py.mjs <script.py> [аргументы]');
  process.exit(2);
}

const script = resolve(HERE, scriptName);
if (!existsSync(script)) {
  console.error(`Нет такого скрипта: ${script}`);
  process.exit(2);
}

const CANDIDATES = [
  ['py', ['-3']],
  ['python3', []],
  ['python', []],
];

function works(cmd, prefix) {
  try {
    const r = spawnSync(cmd, [...prefix, '--version'], {
      stdio: 'ignore', timeout: 10000, shell: false,
    });
    // Windows-шим существует, но завершается ненулевым кодом или ничего не печатает.
    return r.status === 0;
  } catch {
    return false;
  }
}

let chosen = null;
for (const [cmd, prefix] of CANDIDATES) {
  if (works(cmd, prefix)) { chosen = [cmd, prefix]; break; }
}

if (!chosen) {
  console.error(
    'Python 3 не найден. Проверялись: py -3, python3, python.\n'
    + 'Поставьте Python 3.9+ с https://python.org и при установке включите\n'
    + '«Add python.exe to PATH». Вики-проверки без него не запускаются;\n'
    + 'на само приложение это не влияет — оно работает без Python.',
  );
  process.exit(127);
}

const [cmd, prefix] = chosen;
const run = spawnSync(cmd, [...prefix, script, ...rest], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

process.exit(run.status === null ? 1 : run.status);
