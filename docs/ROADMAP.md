# Roadmap — ShareTrip

**The board.** What we are doing, in what order, and where it stands. What to build lives
in the spec; why lives in the evidence; what happened lives in
[sessions/](sessions/README.md). This file carries none of those — it points at them.

**A row is one line.** The Task cell is a name, ≤ 90 characters, no second sentence. The
moment you are typing a fact, a number or a date into a board cell, stop: it belongs in the
work's own document. A board whose cells carry paragraphs is a board nobody can read down,
and that is how you end up scrolling kilobytes of history to answer "what is next".

---

## Status

**Now / Next / Later is the *order*. Status is the *state*.** They are orthogonal: a row in
Now can be paused, and a row in Next can be in flight if somebody started it out of turn.

| | Status | Means | Set it when |
|---|---|---|---|
| ▶ | **Play** | in flight — somebody is on this row, this session | **before the first edit**, not when you commit — [step 0 of the regulation](README.md#update-regulation-mandatory). A second `▶` only when each names its lane: `▶ lane A` |
| ⏸ | **Pause** | started, then stopped, work left on the floor | you stop before Done — and the row says **what remains and where it is** |
| ✅ | **Done** | finished *and* verifiable | the tests pass, the session chunk is written — and the row moves to [Done](#done) **in the same edit** |
| ☐ | *(blank)* | not started | — |

`⊘ dropped` is not a status. A dropped row moves to
[Explicitly not doing](#explicitly-not-doing) **with its revisit trigger**, or it hardens
into dogma nobody remembers deciding.

---

## Now

| # | State | Task | Size | Blocked by |
|---|---|---|---|---|
| 7 | ☐ | Измерить скорость: базис времени до первой отрисовки и до сохранения | ~0.3 d | — |
| 8 | ☐ | Измерить ввод: счётчик касаний на типовую трату, цель ≤ 3 | ~0.3 d | — |

## Next

| # | State | Task | Size | Blocked by |
|---|---|---|---|---|

## Later

| # | State | Task | Size | Blocked by |
|---|---|---|---|---|

---

## Done

**Done rows leave the working tables immediately** — the same edit that turns a row `✅`
moves it here as one line. The board never carries a struck-through paragraph; the record
of what happened is the session chunk, and this line is a pointer to it. Newest first.

| Landed | # | What | Record |
|---|---|---|---|
| 2026-09-15 | 16 | **Свёрнутого блока в форме нет**; PC и Jonsbo — одна машина | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 15 | **Дата и заметка на виду**, у даты пресеты «Вчера»/«Сегодня» | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 6 | **Выгрузка CSV и перенос данных** — четыре листа, `;` и BOM для Excel | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 5 | **Экраны** — лента, быстрый ввод, счета, итог, настройки | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 4 | **«Кто кому должен»** — прямой расчёт с разбивкой, общая касса | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 3 | **Хранение** — IndexedDB одним документом, журнал, копия | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 2 | **Счета и переводы** — обмен, банкомат с комиссией, фактический курс | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 1 | **Денежное ядро** — целые минорные единицы, замороженный курс | [chunk](sessions/02-money-core/2026-09-15-money-core.md) |
| 2026-09-15 | 0 | **The wiki exists** | [chunk](sessions/01-bootstrap/2026-09-15-wiki-bootstrap.md) |

---

## Explicitly not doing

A closed decision, never a silent backlog. **The revisit column is mandatory:** a "not
doing" without a trigger is dogma with a timestamp.

| Not doing | Decided, on record | Revisit if |
|---|---|---|

---

## Open decisions

Questions that block work and are **not yours to answer** — they need the owner, the
operator, or a fact nobody has yet. When one resolves it becomes a numbered `D-` entry and
is struck through here with a pointer, so the history stays visible.

| # | Question | Blocks | Owner | Detail |
|---|---|---|---|---|

---

## Row ids

**Permanent, never reused, next free integer.** Sessions, commits and code comments cite
work as "row 7", so an id must never mean two things. Before using a new number anywhere
else, check it is not already on the board:

```bash
grep -n '^| 7 |' docs/ROADMAP.md   # expect exactly one line, or none
```

`wiki-doctor.py` checks this for every row, which is cheaper than remembering to.
