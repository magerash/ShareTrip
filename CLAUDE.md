@AGENTS.md

# Claude Code

The repo's rules are in [AGENTS.md](AGENTS.md), imported above — **one source, so the two
can never drift.** Anything below is Claude-specific and applies on top of it.

- **Start with the preflight in [docs/README.md](docs/README.md)**, not with the code. Four
  checks, under a minute, and one of them is `git status`: the working tree can be ahead of
  the wiki.
- **Local memory holds a pointer to this wiki, never a copy of it.** If you learn something
  that belongs to the project, it goes in `docs/` where everyone can read it. Auto memory is
  for machine-local facts — paths, which checkout you mean, personal preferences.
- **Do not restate wiki content here.** This file and `AGENTS.md` are loaded into every
  session; the wiki is read on demand. A rule copied into context is a rule that goes stale
  in context.

## Where the rules are

- **The rules that bind every session are in `.claude/rules/`**, loaded alongside this file:
  the git protocol (no git on your own initiative; `Let's finish`, `CB`, `NB` and
  `Night work` are the authorization), verification, documentation and security — and, past
  Core tier, delegation, the file budgets and the design system. They are not restated
  here, and a reader who opens only this file has to be told they exist: one did, on
  2026-09-03, and concluded the scaffold shipped no rules and no commit or version workflow.
- **The vocabulary runs as skills, installed rather than copied**: `/wiki-core:preflight`,
  `/wiki-core:close-session` (`Let's finish`), `/wiki-core:commit` (`CB`),
  `/wiki-core:new-branch` (`NB`), `/wiki-core:night-work`. If they are missing:
  `/plugin marketplace add magerash/llm-wiki-kit`, then `/plugin install wiki-core@llm-wiki-kit`.
- **The commit grammar is `docs/commits.md`** where it exists, otherwise step 6 of the
  update regulation in [docs/README.md](docs/README.md). **The version workflow, in a
  `versioned` project, is the top of `docs/changelog.md`.** Neither is copied here.
