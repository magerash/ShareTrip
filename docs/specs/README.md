# Specs — the contract

**What to build, and how you know it is done.** One file per workstream, copied from
[_TEMPLATE.md](_TEMPLATE.md).

A spec owns the contract. It does not own the evidence (that is `research/`), the order
(that is the board), or the history (that is `sessions/`). It carries **one Status line**
that points at the board — enough for a reader to know whether to trust it as a plan or
read it as a record — and no more state than that. State on two surfaces is state that
disagrees.

## The rule that does the work

**"Looks better", "feels faster" and "is cleaner" are not acceptance criteria.** Name the
number, the assertion, or the artifact that settles the argument.

If you cannot name one, **the stage is not specified yet** — and the honest move is to say
so in the spec rather than paper over it with a criterion nobody can fail. Half the value
of writing specs this way is discovering, cheaply and early, which parts of the work nobody
has actually thought through.

A criterion is good if two people who disagree about whether it was met can settle it
without arguing about taste.

## Sections, and why they are in that order

| § | Section | Job |
|---|---|---|
| 0 | **Read this first** | the *n* things that will save a day: what looks broken but is correct, what looks like a missing feature but is a bug, which parameters are coupled |
| 1 | **Invariants** | what must not break. Anything below that appears to require breaking one is wrong — raise it instead of building it |
| 2 | **Stages** | the work, in build order, each with what / where / acceptance / tests / evidence |
| 3 | **What this spec does not do** | the boundary. Half of all scope arguments are about a line nobody drew |
| 4 | **Open questions** | with the **default you will proceed on** if nobody answers, so an unanswered question does not become a stall |

§0 exists because the same three sentences get discovered independently by everyone who
touches the area, at about a day each.

---

## The specs

| Spec | Status | Board rows |
|---|---|---|
