# Every warning names its fix, and there is no bulk mode

`bearing check` has no `--fix`. Every warning it prints carries the exact command that resolves that one
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
