# 2026-09-15 — the wiki, from the code rather than from memory

The first chunk. It is written about the bootstrap itself, because a session that produced
documents and decisions is a session, and starting the log with an empty folder teaches the
next person that paperwork sessions do not count.

## What was done

| Document | What went into it |
|---|---|
| [../../README.md](../../README.md) | the preflight, the update regulation, the document map, the concept index, the session table |
| [../../code-map.md](../../code-map.md) | {{n}} paths, each verified with `test -e` before it was written down |
| [../../DECISIONS.md](../../DECISIONS.md) | {{n}} decisions, {{n}} assumptions, {{n}} blockers — recovered from the code and from whoever remembered |
| [../../ROADMAP.md](../../ROADMAP.md) | the board, with {{n}} rows in Now |
| [../../environment.md](../../environment.md) | the run command, the machine facts, and {{n}} failure modes that had already cost somebody time |

## How it works

The context window is RAM and `docs/` is disk. Each session leaves a dated chunk here; the
standing documents are the compiled summary of all of them, so the next session reads a
current synthesis instead of replaying logs. Facts are addressable — `D-001`, `A-001`,
`B-1` — and cited by id rather than restated, so no fact exists in two places to disagree
with itself.

Nothing about this depends on a particular tool: it is markdown in git, and `grep` is the
index.

## Decisions (and why)

{{The entries written this session, cited by id with one line each — not restated. If the
bootstrap surfaced something that had never been written down, that is the most valuable
thing here.}}

## Verification

A documentation-only change, so the code is exactly as it was. What was checked instead:

```bash
python3 tools/wiki/check-links.py    # 0 broken
python3 tools/wiki/wiki-doctor.py    # clean
```

Every path in the code map exists; every id cited resolves; the session table names this
chunk. {{And whatever the project's own test command says — run it anyway, so the chunk
records the state the wiki was written against.}}

## Next

{{What you would do first tomorrow. Be specific — "row 1" is useful, "continue" is not.}}
