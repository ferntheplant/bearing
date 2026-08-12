# Every warning names its fix, and there is no bulk mode

`bearing doctor` has no `--fix`. Every warning it prints carries the exact command that resolves that one
instance, and the operator runs the ones they mean.

A bulk fixer produces a diff nobody reads over a class of problem nobody looked at. A named command per warning
is an edit someone chose and can read back afterwards, and it is what keeps warnings meaningful: the moment
output accumulates that nobody can act on individually, everyone learns to ignore all of it.

## Consequences

The warning set stays deliberately small, and one class earns its place today — a trail row for a ticket that
still exists, which is a violation of
[Structure in the map is written only at completion (ADR 0032)](./0032-structure-in-the-map-is-written-only-at-completion.md).

Errors carry no fix command. An error means the tracker is inconsistent rather than untidy, and what to do about
it depends on which of two conflicting things was meant.

A stale blocker id — an id in a ticket's `blockers:` list that no item carries — is an error, so it names no
command. No command edits a `blockers:` list, and that is the point rather than a gap:
[Tracker files are edited directly (ADR 0030)](./0030-tracker-files-are-edited-directly.md) already puts the
list in the operator's hands, so the fix is the hand edit `bearing doctor` points at by naming the ticket and
the id.
