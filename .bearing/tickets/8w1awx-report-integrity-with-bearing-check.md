---
type: build
project: mvp
blockers: [ja2j4z, 5sg7nk]
---

# Report integrity with `bearing check`

## Background

Hand-editing is the design ([Tracker files are edited directly (ADR 0030)](../../docs/adr/0030-tracker-files-are-edited-directly.md)),
and `bearing check` is what makes it safe. Acquisition already accumulates parse failures rather than stopping
at the first; nothing yet compares parsed values against each other, and there is no command.

This lands before any destructive mutation, which is what the read-path-first order in
[Core exposes operations, not tracker internals (ADR 0027)](../../docs/adr/0027-core-exposes-operations-not-tracker-internals.md)
buys: the command that reports a half-finished apply exists before anything can leave one behind.

The error and warning sets are closed
([Every warning names its fix (ADR 0012)](../../docs/adr/0012-every-warning-names-its-fix.md)) — five error
classes and exactly one warning. Adding a sixth is a decision, not an implementation choice.

## Scope

Add cross-document integrity analysis over the observation and the `bearing check` command. Errors: a blocker id
that does not exist, a project no map carries, a design ticket with no project, an unknown type, and a duplicate
id. The one warning is a trail row naming a ticket that still exists, which
[Structure in the map is written only at completion (ADR 0032)](../../docs/adr/0032-structure-in-the-map-is-written-only-at-completion.md)
makes a violation rather than drift.

Out of scope: fixing anything. There is no `--fix` and no bulk mode.

## Done when

- Every parse failure and all five error classes are reported in one run, not just the first.
- The trail-row warning is reported and prints the exact command that resolves it, and no flag applies it in
  bulk.
- The warning's command names the ticket by id and is copy-pasteable as printed.
- A tracker with warnings and no errors exits 0; any error exits 1
  ([Exit status is binary (ADR 0035)](../../docs/adr/0035-exit-status-is-binary.md)).
- A tracker that is entirely clean exits 0 and says so rather than printing nothing.
- `bearing check --json` emits every finding it rendered, with the error and warning distinction carried in the
  data rather than only in the exit status.
- Trail outcome prose is not parsed and links inside it are not followed.
- `vp run ready` passes from a clean checkout.
