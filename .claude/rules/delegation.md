# Delegation

**Delegate by kind, not by quota.** Work that reads many files and returns a short answer —
research, codebase questions, verification, adversarial review — belongs in a subagent,
because the reading costs context and the answer does not. Decisions stay in the main
thread.

**The reviewer is not the writer.** A review by the context that produced the code is a
re-reading, not a review. Run it in a fresh subagent that sees the diff and the criteria and
nothing else. Tell it to flag only gaps that affect correctness or the stated requirements —
a reviewer asked for findings will always produce findings.

**Check the result of delegated work before acting on it.** A subagent returns a summary; the
summary is a claim.

**Never approve your own scope.** An agent that can approve its own scope has no scope. The
operator approves what gets built.

**Stall policy.** If a delegated agent stops making progress for fifteen minutes, or its
process is gone, cancel it and retry once. If the retry also stalls, do the work inline.
Never wait silently — say that it stalled and what you are doing instead.

**Model by job.** Deep reasoning for architecture, security and adversarial review. The
session's model for implementation. The fast tier for lookups and mechanical passes. Picking
a bigger model for a smaller job costs latency and buys nothing; picking a smaller one for
architecture buys a plausible answer.
