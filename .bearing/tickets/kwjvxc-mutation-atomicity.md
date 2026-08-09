---
type: design
project: mvp
clears: [mutation-atomicity]
---

# Mutation atomicity

**What is the failure contract when a mutation is interrupted partway through, and does bearing owe anything
beyond the plan it already printed?**

Closing a build ticket deletes one file and strips its id from the blocker list of an unknown number of others.
Triage moves a file and writes frontmatter. Both are several writes with no transaction around them, and nothing
has decided what a reader is entitled to assume after a kill signal lands between two of them.

The material to weigh:

- The tracker is committed to a repository, and whoever ran the command is looking at `git status` anyway. That
  is a recovery mechanism bearing did not build and cannot break.
- Every mutation is already a plan and an apply
  ([A dry run and a re-run (ADR 0015)](../../docs/adr/0015-a-dry-run-and-a-re-run-never-a-prompt.md)), so the
  operator has seen the full list of edits before any of them happened. A partial apply is legible against a
  plan they just read in a way it would not be against a prompt.
- A blocker that no longer exists is satisfied
  ([Two ticket types (ADR 0007)](../../docs/adr/0007-two-ticket-types-discriminated-by-how-they-close.md)), so
  the half-done state of "file deleted, blocker lists not yet stripped" is not corruption — it is a tracker that
  is merely noisy, and `bearing check` names every dangling blocker with the command that fixes it.
- The reverse order — strip the blockers, then delete — leaves a ticket that exists and blocks nothing, which
  reads as _ready_ rather than as broken. That is the direction that lies.

The failure mode of getting this wrong is a tracker that lies rather than one that errors, and it is cheap to
over-engineer: a write-ahead log or a staging directory is a lot of machinery for a tool whose data lives in
git. The answer might be as small as fixing the order of operations and saying so.

Settles as an ADR. If the answer is "nothing beyond ordering", the ADR still has to exist, because the next
person to look at an interrupted apply will otherwise assume it was an oversight.
