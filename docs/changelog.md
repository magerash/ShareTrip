# Changelog — ShareTrip

**What shipped, newest first.** One line per thing a person would notice, with the substance
carried in the line. The detail lives in the session chunks; this file is the **index over
them**, not a second copy.

Scheme: `v0.0.x` a fix · `v0.x.0` a feature · `v1.0.0` first stable.

---

## Open: `v0.2.0`

**The version every commit subject is currently accumulating into** — `type(v0.2.0): …`.
**This line is the only place that number lives**; a commit subject copies it from here and
from nowhere else. A second copy of a number whose whole rule is that it has one home is
the copy that goes stale.

It is **open, not declared**: it has no entry below and no tag, and it gets neither until a
person says *"let's finish"*.

### Why a version is declared and not accumulated

A version is a claim about a state **somebody looked at**. An agent that bumps the version
once per feature reaches v0.9.0 in a week and the number stops meaning anything — it
becomes a commit counter with dots in it.

So: **the version, this file, the tag and the README badge do not move until a person says
"let's finish."** Writing the open version in a commit subject declares nothing. It is a
label saying which release this work will land in, and that is all.

### The workflow, on "let's finish"

1. Run everything — the tests, the instruments — and record what they said.
2. Read the chunks since the last release; the entry is written from them, not from memory.
3. Write the entry below: the heading, a **bold thesis paragraph naming the thread that
   connects this release**, one emoji bullet per user-visible thing, and always a final
   `✅` bullet carrying the instruments.
4. Update the README badge and anything else that names the version.
5. **Open the next version** by editing the `Open:` line above — in the same change, so the
   repo is never in a state with no open version.
6. Stop there. The commit and the tag are `CB`'s: closing an iteration touches no git, and
   the tag goes on the commit that carries the entry.

---

### v0.1.0 — 2026-09-15 (branch `claude/app-performance-optimization-gaj9ii`)

**Первая версия, которой можно пользоваться в поездке. Связывает всё одно правило: цифра
должна быть воспроизводимой и объяснимой.** Отсюда целые копейки вместо дробных чисел, курс,
который вводит человек и который замораживается в операции, деление, всегда сходящееся в
ноль, и расчёт, который раскрывается по тапу вместо «доверьтесь нам». По тому же правилу
устроены и признания: где числа нет, оно названо отсутствующим, а не заменено словом.

- 💱 **Мультивалютный учёт с замороженным курсом** — трата хранит оригинал, курс и пересчёт;
  изменение курса поездки не двигает уже сохранённое (D-001, D-002). Обменник и банкомат —
  полноценные операции: вводите «ушло 20 000 ₽, пришло 412 AZN», фактический курс считается
  сам и предлагается как курс поездки.
- ⚖️ **«Кто кому должен» с полной разбивкой** — одна строка сверху, под ней по каждому:
  оплата трат, взнос в кассу, возврат долга, доля, доля остатка кассы, итого. Без
  «упрощения долгов» (D-010). Доли распределяются от замороженного итога, поэтому сумма
  долей всегда равна чеку, а лишняя копейка достаётся детерминированно (D-003).
- 🧺 **Общая касса, несколько плательщиков, личная позиция, предоплаты и возвраты** — все
  пограничные случаи из исследования закрыты нативно, без костылей. Расхождение
  замороженных курсов с текущим показано отдельной строкой, а не размазано по долгам (D-007).
- 💳 **Карта — не кошелёк** — наличные и касса ведут остаток, карта копит траты; снятие
  в банкомате расходом не считается. До правки экран заявлял «На руках −4 101,94 ₽» (D-011).
- ⚡ **Ввод за два касания и всё на виду** — сумма, дата с пресетами «Вчера»/«Сегодня»,
  категория, название, заметка; свёрнутых блоков в форме нет (D-013, D-015). Курс
  появляется сам, когда валюта не домашняя.
- 💾 **Работает без сети и не теряет введённое** — всё считается на устройстве, за курсом
  приложение не ходит никогда (D-004). Сохранение немедленное: отложенное на 300 мс теряло
  последнюю трату при перезагрузке (D-008).
- 📄 **Выгрузка CSV в четыре листа** — `;` и BOM, открывается в Excel без плясок. Там, где
  песочница запрещает скачивание, данные показываются текстом для копирования (A-002).
- 🚀 **Запуск на домашнем компьютере и на VPS** — `serve.cmd`, Docker для постоянного
  адреса, `deploy-vps.sh` по правилам машины: коды соседей до и после, замена только своего
  блока Caddy, `validate` → `chown` → `reload`.
- ⚠️ **Общий адрес не значит общие данные** — поездка живёт в браузере устройства; двое с
  разных устройств ведут два расходящихся учёта. Сказано в README, в `deploy.md` и на экране
  «Ещё»; настоящее решение спроектировано в [specs/sync.md](specs/sync.md).
- ✅ **63 теста** (было 0) · 21 шаг сценария в Chromium · 32 проверки прокрутки · 20 проверок
  формы · `check-links` 104 ссылки, 0 битых · `wiki-doctor` 10 проверок, 0 отказов.
  **Не измерено и потому не утверждается:** скорость (нет тайминга, строка 7) и «ввод за 2–3
  касания» (нет счётчика касаний, строка 8).
