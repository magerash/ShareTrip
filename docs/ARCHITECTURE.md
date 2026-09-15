# ARCHITECTURE — ShareTrip

**The system's shape, and the contracts that bind the code.** Cited from specs, commits and
code comments as `ARCHITECTURE.md §2`, so the section numbers are addresses: renumber a
section and you break every citation to it. Add, do not renumber.

This document holds what is *true of the system*. It does not hold status (that is the
board), evidence (that is research), or history (that is the sessions).

---

## 1. The founding decision

{{Open by restating the design that was *not* taken — the obvious sketch somebody proposed
first — and then the one that was, with the reason. A reader who does not know what was
rejected will propose it again, and this is the cheapest possible place to answer them.}}

    {{the rejected sketch, as a one-line pipeline}}

**{{The recommendation, stated flatly.}}** {{Why. Cite the decision id.}}

    {{an ASCII block diagram of what was built instead — boxes, arrows, and the
    names the code actually uses. It is worth the twenty minutes: this is the picture
    people hold in their heads, and if you do not draw it they will each draw a
    different one.}}

## 2. The contracts

A contract is a fact that **more than one file depends on** and that nothing enforces at
runtime. That is the definition worth using, because it selects exactly the facts that
break silently.

### 2.1 {{contract name}}

{{State it as an invariant, in one sentence, with units and directions where they apply.
Then: where it is established, who relies on it, and what the symptom is when somebody
violates it — because the symptom is never "the contract was violated", it is
"the thing rendered upside down" or "the totals are off by a day".}}

**There is no conversion anywhere — keep it that way.** {{Or, if there is one: name the
single boundary where it happens, and say that adding a second one is the bug.}}

## 3. Data shapes

{{The structures that cross a boundary — a file format, an API payload, a message. Give the
shape, name the required fields, and say which producer writes it and which consumer reads
it. A shape with two producers is a shape that will drift; if there are two, say so and say
which is authoritative.}}

## 4. Runtime structure

{{How it is put together while running: the phases, the loop, the lifecycle, the thing that
owns state. Include the budgets, if the system has any — what has to stay under what — and
say where the number came from.}}

## 5. The integration surface

{{If this project is coupled to another, state precisely what is shared: schema or code,
data or types. "Coupled by a schema, never by code" is a very different system from "we
import their library", and the difference is invisible until you try to upgrade.}}
