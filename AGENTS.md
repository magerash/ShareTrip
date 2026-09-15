# ShareTrip

ShareTrip is a travel expense tracker for **two people**. It answers one question — *who owes
whom, and why* — across several currencies, cash and cards, and a shared cash kitty. The
architectural fact that explains most of the rest: **there is no build step and no network
call.** The client is plain ES modules served as static files; every amount is an integer
number of minor units; every exchange rate is typed by a human and frozen into the operation
that used it. A rate is never fetched, so the app is correct in a roaming dead zone and the
balances never move under you after the fact.

**Canonical knowledge is the wiki in `docs/`. Read [docs/README.md](docs/README.md) before
starting** — it carries the preflight, the update regulation, the document map and the
"concept → where to look" index.

<!--
This file is the single source of the repo's rules, and every agent reads it:
AGENTS.md is read natively by most coding agents, and CLAUDE.md at the root imports it
with `@AGENTS.md` so Claude Code reads the same text rather than a second copy of it.
Do not paste these rules into another file. Point at this one.

Keep it under ~200 lines. It is loaded into context at the start of every session, and a
long instruction file gets followed less reliably than a short one.
-->

## The rules of this repo

- **Mark the roadmap when you start, not only when you finish.** Set the row you are about
  to work on in [docs/ROADMAP.md](docs/ROADMAP.md) to `▶` **before the first edit**, one
  row at a time; when you stop, set the status that is true — `✅` finished and verifiable,
  `⏸` **with what remains and where it is**, never back to `☐`. It costs one character, and
  what it prevents is a second session starting work already half-built in somebody's
  working tree.
- **After every feature or iteration, follow the "Update regulation" in
  [docs/README.md](docs/README.md)**: a chunk in `docs/sessions/NN-slug/2026-09-15-topic.md`,
  synthesis into the documents the change touched, then the index rows and the checkers.
- **If anything about the machine or the procedure changed, update
  [docs/environment.md](docs/environment.md)** — a version, a path, a port, a command, or a
  failure mode you hit that nobody had written down. It is the step that rots silently,
  because the code never tells you the environment doc is stale.
- **Cite ids, don't restate.** Decisions (`D-nnn`), assumptions (`A-nnn`) and blockers
  (`B-n`) are numbered in [docs/DECISIONS.md](docs/DECISIONS.md). New entries are appended
  and supersede old ones; history is not rewritten.
- **A commit has the changelog's shape.** Subject `vX.Y.Z Name of the session's work`, the
  version copied from the `Open:` line of `docs/changelog.md` and never bumped here; body a
  short list — one emoji bullet per change carrying the number that was wrong and the
  alternative rejected, a `📚 Wiki —` line, a `✅` instruments line (if one could not run,
  say so there), the ids last. Roughly twenty lines at most; the reasoning is the chunk. This
  project releases as `versioned` — a `wiki-artefact` project has no version and writes
  `type(scope): the name` instead. The commit gate enforces the shape; the grammar is
  `docs/commits.md` where it exists.
- **Measure, don't guess.** The instruments are `node --test "tests/*.test.mjs"` (57 cases:
  money core, settlement model, CSV) and `node smoke.mjs` — a Playwright run that drives the
  real UI in Chromium and asserts the numbers *on screen*. Two claims have no instrument yet
  and must not be asserted without one: "the app is fast" (no timing baseline) and "entry
  takes 2–3 taps" (no tap counter). Both are rows in `docs/ROADMAP.md`.

## Run and verify

```bash
python3 -m http.server 8000 --directory web
```

```bash
python3 -m http.server 8000 --directory web  # then open /tests/
```

Then, before you commit:

```bash
python3 tools/wiki/check-links.py && python3 tools/wiki/wiki-doctor.py
```

## Load-bearing facts

The things that are expensive to learn by reading the code. Each one has already been got
wrong at least once, in this repo or in the apps the research surveyed:

- **Money is integers, never floats.** Every amount is a whole number of minor units
  (kopecks, cents) plus a currency code. `web/js/money.js` owns all of it: parsing, rounding,
  rate arithmetic in `BigInt`. Nothing else may do arithmetic on money. A `0.1 + 0.2` in a
  view is a bug even when the displayed number looks right.
- **A rate is a string, and it is frozen.** `rate` is a decimal *string* ("48.543689") meaning
  *how much home currency for one unit of the foreign currency*. An expense stores the
  original amount, the rate, **and** the converted `amountHome`. Recomputing `amountHome`
  later is forbidden — that is exactly the Splitwise complaint the app exists to avoid.
- **Shares are allocated, not converted.** Per-person amounts in home currency come from
  `allocate(amountHome, weights)` (`homeShares`), never from converting each share
  separately. Converting separately makes the shares disagree with the total by a kopeck.
- **Rounding is deterministic.** `allocate()` uses largest-remainder with index tie-break,
  so the same input always produces the same split. Splitwise distributes the odd penny
  *randomly*; we must not, and a test asserts it.
- **`Σ final === 0` is the invariant that matters**, not `Σ net === kitty balance`. Frozen
  rates drift against the trip's current rate, so the physical kitty balance and the divisible
  pool differ; `settlementPlan` divides the pool and reports the difference as `fxDrift`
  (D-007). Do not "fix" the drift by recomputing frozen rates.
- **The account balance uses what the bank actually took.** When a card in one currency pays
  a bill in another, `payer.chargedAmount` drives the balance while the *split* uses the
  expense's own frozen rate (D-005). The two are meant to differ; that difference is the
  card's margin, not an error.
- **A card is not a wallet.** `tracksBalance()` decides whether an account reports a balance
  (cash, kitty) or accumulated spending (card). "Spent" counts expenses and fees only — a
  transfer to your own account is not spending, or the same money shows up both as spent and
  as cash in hand (D-011).
- **Bottom-bar clearance belongs to the content, not to `body`.** `--nav-clear` is applied
  as `padding-bottom` on `.view`. A `padding-bottom` on `body` stops extending the scroll
  area the moment anything gives `body` a fixed height, and the last 30–40px of every screen
  hides under the fixed nav (D-012). Never set `height` on `body`; run `npm run layout`
  after touching page-level layout.
- **Never pass a conditional child to native `.append()`.** `el.append(null)` inserts the
  literal text "null". Use `mount()` from `web/js/ui.js`, which filters. This shipped once
  and put stray "null" on the settlement screen.
- **Russian has grammatical gender and cases; a name does not tell you either.** Never build
  a sentence like `${name} должен ${name}`. Use the neutral arrow form (`Аня → Вова`) and
  genderless labels ("долг", "переплата"). A smoke check greps for the regression.

