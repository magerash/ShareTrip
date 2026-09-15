# Changelog — ShareTrip

**What shipped, newest first.** One line per thing a person would notice, with the substance
carried in the line. The detail lives in the session chunks; this file is the **index over
them**, not a second copy.

Scheme: `v0.0.x` a fix · `v0.x.0` a feature · `v1.0.0` first stable.

---

## Open: `v0.1.0`

**The version every commit subject is currently accumulating into** — `type(v0.1.0): …`.
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

### v{{x.y.z}} — 2026-09-15 (branch `{{branch}}`)

**{{The thesis: the one thing that connects everything in this release. Written last, after
you have read the chunks, because you cannot know the thread until you see them all.}}**

- 🔧 **{{A name for the change}}** — {{the substance, with the numbers and the ids}}
- ✅ **{{n}} assertions** (was {{n}}) · {{the other instruments, per subject}}
