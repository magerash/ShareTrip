# Commits — ShareTrip

A commit is read by somebody scanning `git log` with no context, so it has the changelog's
shape: **a version, a name, a short list.** The evidence travels in it — the number that was
wrong, the instrument that ran, the alternative rejected — **one line each, never a
paragraph.** The reasoning lives in the session chunk; the commit points at it.

This project releases as **`versioned`** (declared in `.claude/rules/documentation.md`).
`tools/wiki/hook_gate.py` enforces the shape below before every commit.

---

## The shape

```
vX.Y.Z Name of the session's work, in the domain's words

🔧 Thing a person notices — the substance: the number that was wrong, the cause
🚀 Another — and the alternative rejected, if there was one
📚 Wiki — sessions/NN-slug/2026-09-15-topic.md · the documents it was folded into
✅ n assertions (was n) · check-links 0 broken · doctor 0 failures

D-nnn · A-nnn · B-n
```

**The subject.** `vX.Y.Z` is **copied from the `Open:` line of `docs/changelog.md`**, never
bumped by a commit; the release commit alone carries the number of the entry it adds. The
name is the thesis of the session, one line, not a list. Under ~95 characters.

In a `wiki-artefact` project — no version number at all — the subject is
`type(scope): the name` instead: `feat` · `fix` · `docs` · `test` · `chore`, scope
{{what this project scopes by: a module or a lane}}, same length rule.

**The body.** One emoji bullet per thing a person would notice, substance in the line. A
`📚 Wiki —` line. A `✅` line, always — if an instrument could not run, that is what it
says. The ids last. Roughly twenty lines at most; if you need more, you are writing the
chunk. Keep one emoji taxonomy: 🔧 fix · 🚀 feature · 🛡️ security · 🗑️ removal · 📚 wiki ·
✅ instruments.

On `Let's finish` the bullets become the changelog entry. They are written once.

## What a body must not contain

- **A file list.** `--stat` prints it.
- **A restated decision.** Cite `D-0nn`. The ledger is the copy.
- **"Looks better."** {{Name this project's instrument instead.}}
- **A number you did not measure this session, quoted as if you had.**
- **A paragraph.** A bullet that needs a second sentence is two bullets, or a chunk.
- **Silence about the cheap half.** If you shipped the stopgap, one bullet says so and names
  the route not taken.

---

## An example

```
v0.7.2 Stale reads after a write — the cache key ignored the tenant

🔧 Cache key — built from the resource id alone, so tenant B's write evicted nothing for A; read-after-write window was 300 s, is 0 s. Rejected: TTL 5 s — hides it at 60× the load
🛡️ Session cache — same shape, deliberately untouched: single-tenant by construction
📚 Wiki — sessions/07-the-cache-lied/2026-09-15-the-key-ignored-the-tenant.md · code-map
✅ 214 assertions (was 209) · test_stale_read reproduces the 300 s window · check-links 0 broken · doctor 0 failures

D-014 · A-007
```
