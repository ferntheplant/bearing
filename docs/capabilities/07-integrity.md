# Integrity

One command that reads the whole tracker and tells you what is inconsistent — and, for everything it can, prints
the exact command that fixes it. This is what makes hand-editing safe: the files are yours, and this is how you
find out when an edit broke a link.

## What you can expect

- **`bearing check` is the whole of it.** It reads everything and reports; it is not a mode of another command.
- **Parse failures are loud.** Every command refuses a tracker whose structure it cannot parse; `bearing check`
  accumulates those failures rather than stopping at the first one.
- **Integrity errors, which mean parsed values are inconsistent:** a ticket blocked by an id that does not
  exist, a ticket naming a project that does not exist, a design ticket with no project, an unknown type, a
  duplicate id.
- **One warning, which means the map got ahead of itself:** a trail row for a ticket that still exists. A row is
  written as its ticket closes and never before, so one standing alone is either a close that stopped halfway or
  a row someone wrote in advance.
- **Trail outcome prose stays prose.** Bearing checks that the row exists and has a non-empty outcome when a
  design ticket closes; it does not parse or follow links embedded in that outcome.
- **There is no `--fix`.** The warning prints the command that resolves it. Running that command applies its one
  named edit directly, which is more legible than a bulk-produced diff.
- **The warning stays meaningful.** The whole point of naming the fix is that nobody learns to ignore the
  output, which is also why there is only one warning left to ignore.
- **No update broadcasting in the MVP.** `bearing check`, setup, and ordinary commands stay local and print no
  version notice.
- **Process status is binary across the CLI.** Zero means the requested operation succeeded, including a valid
  no-op and a warnings-only integrity check; one covers every refusal, invalid invocation, integrity error, and
  operational failure. Structured diagnostics carry the distinction.

## Where it stands

**Partial.** Tracker acquisition retains every malformed document and ticket listing refuses with accumulated
filename, frontmatter, and local-document diagnostics. `bearing check`, cross-document integrity analysis, the
single warning, and fix commands remain settled, not built.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **24** (every error class and the warning are reported) and
**25** (the warning carries the command that resolves it, and there is no bulk fix).

## Decisions

- [Every warning names its fix, and there is no bulk mode (ADR 0012)](../adr/0012-every-warning-names-its-fix.md)
  — the pattern the whole command follows.
- [Structure in the map is written only at completion (ADR 0032)](../adr/0032-structure-in-the-map-is-written-only-at-completion.md)
  — what the one remaining warning is actually catching.
- [Nothing points at a fog patch (ADR 0033)](../adr/0033-nothing-points-at-a-fog-patch.md) — why there is no
  drift diagnostic left.
- [Three flat directories, and a project is a map file (ADR 0005)](../adr/0005-three-flat-directories-and-a-project-is-a-map-file.md)
  — why "a design ticket lives in a project" is a check here rather than a property of the filesystem.
- [Mutations are ordered, not atomic (ADR 0025)](../adr/0025-mutations-are-ordered-not-atomic.md) — why an
  interrupted apply tends toward the duplicate ids and dangling blockers this command reports.
- [Core exposes operations, not tracker internals (ADR 0027)](../adr/0027-core-exposes-operations-not-tracker-internals.md)
  — why malformed documents remain evidence in the one tracker read instead of stopping it at the first error.
- [Exit status is binary (ADR 0035)](../adr/0035-exit-status-is-binary.md) — why diagnostics, rather than a
  growing set of process statuses, distinguish failures.
