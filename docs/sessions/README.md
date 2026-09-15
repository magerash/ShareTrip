# Sessions

**What actually happened, dated.** One folder per episode of work, numbered in order; one
dated chunk per feature or iteration inside it.

This is the raw-material layer. The synthesis documents are compiled *from* these, and when
the two disagree: **the chunk wins about what happened, the synthesis wins about how things
are now.** That rule is what lets a chunk stay written as it was, forever.

A session folder never carries anything forward-looking. What to build next lives in
[../ROADMAP.md](../ROADMAP.md); why lives in [../DECISIONS.md](../DECISIONS.md).

## Opening a session

```bash
python3 tools/wiki/new-session.py "what this episode is about"
```

It claims the next free number under a lock — with two agents in one checkout the id space
races, and a session number that means two things breaks every citation to it — then writes
the folder, its README, a dated chunk from the template, and both index rows.

## What a chunk must contain

Three required headings, checked by `wiki-doctor.py`:

| Heading | Job |
|---|---|
| `## What was done` | the change, in the domain's words |
| `## Verification` | what you ran and what it said. For a planning session this is *not* empty — it is: every cited path exists, every id resolves, the checkers are clean |
| `## Next` | what you would do first if you sat down again tomorrow. This is the heading the next session actually reads |

Two more are expected and warned about when missing: `## How it works` (the mechanism, so
the reader does not have to re-derive it) and `## Decisions (and why)` (with the `D-` ids,
cited not restated).

## Archiving

When this folder passes ~50 sessions, fold the closed ones into `ARCHIVE-YYYY.md` — one
line each, pointing at the folder, which stays on disk. The index is what gets long, not
the history. Write the rule down now, while it costs nothing.

---

## The sessions

Newest first.

| # | Session | Dates | What came out of it |
|---|---|---|---|
| 02 | [02 · money-core](02-money-core/README.md) | 2026-09-15 | money-core |
| 01 | [bootstrap](01-bootstrap/README.md) | 2026-09-15 | this wiki |
