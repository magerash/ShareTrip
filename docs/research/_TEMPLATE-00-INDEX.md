# Research — {{the question, phrased as a question}}

**Written:** 2026-09-15 · **Baseline:** `{{commit}}` on `{{branch}}` · **Findings:** {{F}}-01…{{F}}-nn
**Feeds:** [../../specs/{{slug}}.md](../../specs/{{slug}}.md) · **Board:** rows {{n}}–{{n}}

{{Two or three lines: what was asked, what came back, what it implies. If this started from
something somebody said, quote them — the original sentence is usually more precise about
the actual want than any paraphrase of it.}}

> *"{{the ask, verbatim}}"*

---

## The headline conclusions

Numbered, each one citing the findings behind it. If a conclusion has no id behind it, it
is an opinion and belongs in the recommendation section instead.

1. **{{Conclusion, stated flatly.}}** {{F-01}}, {{F-04}}. {{One line of why it matters.}}
2. **{{Conclusion.}}** {{F-07}}. {{Why.}}

## The documents

| # | Document | Covers | Findings |
|---|---|---|---|
| 01 | [01-{{slug}}.md](01-{{slug}}.md) | {{what}} | {{F}}-01…{{F}}-06 |

## Every route considered, with a verdict

The point of the pack. Judge every row against the same stated constraints, and **say which
one to take**.

**Constraints every row is judged against:** {{the real ones — the budget, the runtime, the
licence rule, the thing that must not regress}}.

### A. Take it — the recommended set

| # | Route | Cost | Verdict |
|---|---|---|---|
| A1 | **{{route}}** | {{n days}} | **Take first.** {{why — with the id of the finding that makes the case}} |

### B. Take it, but it costs a decision

| # | Route | Cost | What it costs | Verdict |
|---|---|---|---|---|
| B1 | **{{route}}** | {{n days}} | {{a dependency, a licence, a size}} | **Recommend**, once {{OD-n}} is answered |

### C. Not now — with the condition that would change that

| # | Route | Why not now | Reopen if |
|---|---|---|---|
| C1 | **{{route}}** | {{reason}} | {{the specific trigger}} |

### D. Closed

| # | Route | Why it is closed |
|---|---|---|

## How claims were established

**Measured** — a number was read off a run. **Read** — traced in source, derivation written
out. **Observed** — seen but not quantified. **Cited** — external, linked and dated.

## Sources

- [{{title}}]({{url}}) — read 2026-09-15
