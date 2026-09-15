# Documentation

**Read the document that owns the area before you change the area; update it in the same
change.** The ownership table is in [docs/README.md](../../docs/README.md). A change that
lands without its document is a change the next session has to re-derive from the diff.

**A fact lives in exactly one place; everything else cites it by id.** Decisions `D-nnn`,
assumptions `A-nnn`, blockers `B-n`. Restating a decision creates a second copy that will
disagree with the first, and there is no way to tell which one is lying.

**Numbers in prose are written by a script, not by hand.** Counts, totals and sizes live
inside `<!-- counts -->` markers that `wiki-doctor.py --fix` regenerates. An index once
claimed 48 decisions while the ledger held 110.

**The always-loaded files point at knowledge; they do not carry it.** `AGENTS.md` and this
directory are read every session. The wiki is read on demand. A rule copied up here is a
rule that goes stale up here.

**The index is a document with an owner.** If the entry point stops listing what exists,
retrieval silently returns the wrong set and nobody sees an error.

**Changelog entries are professional and minimal.** They are read far more often than they
are written.

**This project releases as `versioned`.** A `versioned` project bumps a version and
writes a changelog entry when the operator says `Let's finish` — the workflow is the top of
`docs/changelog.md`, which a versioned project receives at every tier — and its commit
subject may carry the changelog line. A `wiki-artefact` project has neither — the wiki is what ships, and a
version number nobody looks at is a number nobody keeps true.
