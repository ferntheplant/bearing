# Mutations are ordered, not atomic

Bearing does not make a multi-file mutation atomic and does not roll one back. An interrupted apply may leave
any completed prefix of the plan on disk; the caller is not entitled to assume all-or-nothing completion or
automatic recovery. The internal plan records the intended edits; when the tracker is committed, version control
provides inspection and restoration.

Completed edits are ordered so that a partial apply is noisy rather than plausibly false. Closing deletes the
ticket before stripping its id from blocker lists: interruption can leave dangling blockers, which are already
satisfied and which `bearing doctor` reports, instead of making dependents look ready while the blocker still
exists. Triage and retitle write the destination before deleting the source: interruption can leave a duplicate
id, which resolution and `bearing doctor` reject, instead of making an item disappear as though it had been
deliberately deleted.

## Consequences

Bearing has no write-ahead log, staging directory, signal-time rollback, or recovery command. The ordering
guarantee applies between completed filesystem operations; interruption during one write may leave that file
incomplete, and recovery remains ordinary inspection or, where available, restoration from version control.
