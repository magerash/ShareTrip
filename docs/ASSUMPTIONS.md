# ASSUMPTIONS — ShareTrip

**Things taken as true without checking.** `⚠️` marks the ones that would hurt.

Split out of [DECISIONS.md](DECISIONS.md) at the Standard tier; the `A-` ids did not change
and never will. Append-only, same as the other ledgers: a superseded assumption gets a
blockquote above it, not an edit.

**Every entry ends with `Falsified by:`** — the cheapest observation that would prove it
wrong. An assumption without a falsifier is an opinion, and it will be inherited by every
future session as though it were a measurement. With one, a later session can kill it in
five minutes.

Be specific about **size**. "1.25 % of the trees" and "every request" are both assumptions
and they are not remotely the same risk.

---

## A-001 — Участников всегда двое ⚠️

**2026-09-15** · `web/js/model.js`, `web/js/views/settle.js`

Модель хранит `people` массивом и считает `netPositions` для любого количества, но интерфейс
исходит из двоих: форма создания поездки просит ровно два имени, деление рисует два поля,
итог показывает одну строку «кто → кому». Отсюда же решение не делать «упрощение долгов»
(D-010).

Почему мы так думаем: приложение писалось под конкретную пару, а исследование показывает,
что именно для двоих существующие приложения работают хуже всего — они оптимизированы под
группы.

Насколько это велико: `settlementPlan` уже строит список переводов жадным алгоритмом и
корректен для N участников. Переделки требует интерфейс — примерно три экрана.

**Falsified by:** первая же просьба добавить третьего человека в поездку.

## A-002 — Скачивание файла может быть запрещено, и тогда данные надо показать текстом ⚠️

**2026-09-15** · `web/js/csv.js` (`canDownload`), `web/js/views/more.js` (`offerFile`)

Во встроенном просмотрщике артефактов песочница блокирует ссылку `download`: клик не
скачивает ничего и не сообщает об ошибке. Мы считаем признаком такой среды `window.self !==
window.top` и в ней показываем текст для копирования вместо файла.

Почему мы так думаем: это прямо описано в контракте страницы артефакта. Проверить поведение
в самой песочнице мы не смогли — браузерный прогон идёт на локальном сервере в верхнем
окне, где скачивание работает и проверено.

Насколько это велико: затрагивает единственный путь, которым данные покидают устройство.
Если признак определён неверно, человек получит лишнее окно с текстом — неприятно, но
данные не теряются. Обратная ошибка (молча не скачать и ничего не показать) была бы потерей.

**Falsified by:** открыть опубликованный артефакт, нажать «CSV — всё» и посмотреть, что
произошло: файл, окно с текстом или ничего.
