# Research — the evidence layer

**What was measured, what was read, what the options are, and what each one costs.**
Research does not carry status (that is the board) and does not carry the contract (that is
`specs/`). It is the layer everything else cites.

## The rule that makes this worth writing

**Research does not merely list options — it *ranks* them and names a recommended route.**
And the recommendation is the **default**: if you build something else, including a cheaper
stopgap the spec also lists, you say so **in the same commit** — which route was
recommended, why you are not taking it now, and what it would cost.

This is not ceremony. A stopgap shipped silently reads as *"this is the answer"*, and the
recommended route then looks considered-and-rejected when in fact nobody ever considered
it. Six months later the cheap version is load-bearing and the reason is lost.

## Findings are numbered, and each pack gets its own letter

`F-01`, `P-14`, `V-28`. One letter per pack, so an id is unambiguous across the whole wiki
and a spec, a commit or a code comment can point at a measurement instead of repeating it.
Ids are permanent, including for findings that later turn out wrong — a wrong finding that
somebody built on is exactly the thing you want to still be able to cite.

## How a claim was established — say which

| Word | Means |
|---|---|
| **Measured** | a number was read off a run. Say what you ran |
| **Read** | traced in source; the derivation is written out |
| **Observed** | seen in the running system, not yet reduced to a number |
| **Cited** | an external source, linked and dated |

A reviewer needs to know which is which, and the distinction is invisible once the finding
is compressed to one line.

## Adding a pack

1. `research/<topic>/00-INDEX.md` — the map, the headline conclusions, the bibliography.
2. Numbered documents from `01-` up. If the pack audits existing code, make `01-` the audit
   and give every finding a citable id straight away.
3. State how each claim was established.
4. Add a row to the table below, and one to the document map in `../README.md`.
5. **A pack that recommends work produces a spec; the spec produces board rows.** Do not
   let a research document accumulate status — it will go stale and stop being trusted, and
   a research document nobody trusts is worse than none, because the numbers still get
   quoted.

---

## The packs

| Pack | About | Ids | Feeds |
|---|---|---|---|
