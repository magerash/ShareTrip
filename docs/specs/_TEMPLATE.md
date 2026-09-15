# Spec — {{the outcome, not the mechanism}}

**Status:** not started — the state lives on [the board](../ROADMAP.md), rows {{n}}–{{n}}
**Written:** 2026-09-15 · **Baseline:** `{{commit}}` on `{{branch}}`
**Research:** [../research/{{topic}}/00-INDEX.md](../research/{{topic}}/00-INDEX.md), cited as `{{F}}-nn`

{{One paragraph: what changes and why now. Evidence cited by id, never restated.}}

---

## 0. Read this first — {{n}} things that will save you a day

1. **{{The thing that looks broken but is correct}}** — and what the symptom actually is.
2. **{{The thing that looks like a missing feature but is a bug}}** — with the id.
3. **{{The parameters that are coupled}}** — change them in this order, re-measure between.

## 1. Invariants — do not break these

Anything below that appears to require breaking one is wrong. Raise it instead of building
around it, because building around an invariant is how it stops being one.

| # | Invariant | Why | Falsified by |
|---|---|---|---|
| I-1 | {{the invariant, as a flat statement}} | {{ARCHITECTURE.md §n}} | {{the observation that would prove it violated}} |

## 2. Stages

Build order. A stage is the smallest thing that can be finished, verified and committed.

### Stage {{n}} — {{name}}

**What:** {{two or three lines}}
**Where:** `{{path}}`, `{{path}}`
**Acceptance:** {{a number, an assertion, or a regenerable artifact. Not an adjective.}}
**Tests to add:** {{name — and what it asserts, which is not the same thing}}
**Evidence:** {{F-nn}}

## 3. What this spec does not do

{{The boundary, stated positively where possible: "this owns the choice; the asset pipeline
owns the swap". Name the neighbouring spec or module that owns each excluded thing, so the
sentence is a pointer rather than a refusal.}}

## 4. Open questions

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| {{A-nn / OD-n}} | {{the question}} | {{stage}} | {{the assumption you will proceed on}} |

---

## Hand-off

Paste this into a coding agent. It **points**; it does not restate — restating is how two
documents start disagreeing.

```
Read first, in order:
  docs/specs/{{slug}}.md               — the contract (§0 will save you a day)
  docs/research/{{topic}}/00-INDEX.md  — the evidence, cited as {{F}}-nn
  docs/README.md                       — the update regulation you follow at the end

Build: {{stage or stages}}, in the order the spec gives.
Honour: invariants I-1, I-4 — anything that seems to need breaking one is wrong, raise it.
Do not: {{the specific trap}}.

Verify: {{the exact command}} → {{expected}}
        {{the measurement}}  → {{threshold}}

Then follow the update regulation in docs/README.md: mark the row, session chunk,
synthesis, environment check, index rows, checkers.
```
