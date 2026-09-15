# Verification

**Nothing is reported as verified without running something and quoting the output.** Not
"tests pass" — the command and what it printed. A green light wired to nothing is worse than
no light, because somebody acts on it.

**If you could not run the instrument, say so in the same sentence as the claim.** "The
handler should now return 404; I could not run the suite because the database was not up" is
useful. "Fixed" is not.

**"It looks better" is not an acceptance criterion.** A criterion is good if two people who
disagree about whether it was met can settle it without arguing about taste. If a claim you
keep wanting to make has no instrument behind it, that gap is a roadmap row.

**What the instruments cannot see is handed over as a numbered test case, not as "please
check".** `TC-n`, the steps, the pass/fail criterion, and where the evidence will show — a
log tag, a screen, a row. A build shipped without its test list is a blind upload: the
operator cannot judge it, so it gets judged as fine.

**Never compare against a number from an earlier session.** Re-derive the baseline in the
same run, on the same machine, or the comparison measures the afternoon.

This project's instruments:

```bash
python3 -m http.server 8000 --directory web  # then open /tests/
```

Before any commit, both checkers:

```bash
python3 tools/wiki/check-links.py && python3 tools/wiki/wiki-doctor.py
```

This is also enforced by a hook, so a failing checker denies the commit rather than
disappointing somebody later. The rule stays written down because the hook can be absent —
in a fresh clone, in CI, in another agent — and the rule cannot.
