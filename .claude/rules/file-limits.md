---
paths:
  - "web/js/**/*.js"
---

# File limits

A cap is a smell with a prescribed remedy, not a fault. Crossing one means the file has
started doing a second job; the remedy names which job to move out.

The table is read by `tools/wiki/hook_caps.py`, so the columns are fixed: a name, a glob the
file must match, the budget, and the remedy.

| Kind | Glob | Max lines | When it is exceeded |
|---|---|---|---|
| Денежное ядро | `web/js/money.js`, `web/js/model.js` | 400 | Ядро распухло — значит в него заехало то, что ядром не является. Вынести в `web/js/` соседним модулем; DOM и база в ядро не попадают никогда. |
| Экран | `web/js/views/*.js` | 550 | Экран делает вторую работу. Вынести шторку в отдельный файл рядом (`views/<экран>-<что>.js`), а не дробить по строкам. |
| Оболочка и утилиты | `web/js/{app,ui,store,db,csv,currencies}.js` | 400 | Утилита обросла предметной областью. Предметное — в `model.js`, общее — оставить. |
| Стили | `web/css/*.css` | 700 | Стили начали описывать конкретные экраны. Завести файл на экран и оставить здесь только токены и общие блоки. |
| Тесты | `tests/*.test.mjs` | 600 | Файл проверяет две разные вещи. Резать по предмету (`money` / `model` / `csv`), а не по размеру. |

**Dependencies point inward.** The core carries no framework imports, so it can be read and
tested without booting anything. Sibling features do not import each other — shared logic
moves to the shared root instead.

**Every repository and every external integration sits behind an interface** declared in the
layer that owns it. The implementation is replaceable; the interface is the contract other
code is written against.

**Configuration over branching.** Differences between environments, tenants or builds live in
data, not in `if` chains that every reader has to re-derive.
