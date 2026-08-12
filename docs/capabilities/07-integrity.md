# Integrity

One command that reads the whole tracker and tells you what is inconsistent — and, for everything it can, prints
the exact command that fixes it. This is what makes hand-editing safe: the files are yours, and this is how you
find out when an edit broke a link.

## What you can expect

- **`bearing doctor` is the whole of it.** It reads everything and reports; it is not a mode of another command.
- **Every check reports, including the ones that pass.** The output names each check and says what it found, so
  "was that even looked at?" is answered by the command rather than by the source. A check that finds nothing
  says so by name; a check that finds something lists its findings underneath it.
- **Unexpected files at the tracker root are tolerated silently.** Acquisition reads only `backlog/`, `tickets/`,
  and `maps/`, and anything else sitting in `.bearing/` is not a finding. Tolerating means saying nothing, and
  that is chosen rather than accidental: the error set is closed
  ([Every warning names its fix (ADR 0012)](../adr/0012-every-warning-names-its-fix.md)), so naming a file
  bearing does not own would be a sixth class and a decision, not a report.
- **Parse failures are loud.** Every command refuses a tracker whose structure it cannot parse; `bearing doctor`
  accumulates those failures rather than stopping at the first one.
- **Integrity errors, which mean parsed values are inconsistent:** a ticket blocked by an id that does not
  exist, a ticket naming a project that does not exist, a design ticket with no project, an unknown type, a
  duplicate id.
- **One warning, which means the map got ahead of itself:** a trail row for a ticket that still exists. A row is
  written as its ticket closes and never before, so one standing alone is either a close that stopped halfway or
  a row someone wrote in advance.
- **Trail outcome prose stays prose.** Bearing checks that the row exists and has a non-empty outcome when a
  design ticket closes; it does not parse or follow links embedded in that outcome.
- **There is no `--fix`.** The warning prints the command that enters the design-close dry run for that ticket;
  the dry run then prints the re-run that applies its one named edit. This is more legible than a bulk-produced
  diff.
- **The warning stays meaningful.** The whole point of naming the fix is that nobody learns to ignore the
  output, which is also why there is only one warning left to ignore.
- **No update broadcasting in the MVP.** `bearing doctor`, setup, and ordinary commands stay local and print no
  version notice.
- **A warnings-only run still succeeds.** Exit status across the whole CLI is binary
  ([The command line](./09-the-command-line.md)); here that means warnings exit 0 and any error exits 1.

## Where it stands

**Built.** `bearing doctor` reads the whole tracker and runs seven checks in one pass — document parsing, id
collisions, ticket types, design ticket projects, project references, blocker references, and trail rows —
naming each one and listing its findings underneath, then closing with a count. It renders the same value as
`--json`, with the checks, their severity, and their findings all carried in the data. A warnings-only tracker
and a clean tracker both exit 0 (a clean one says so), and any error exits 1. The warning names
`bearing close <id>` as its copy-pasteable entry into the design-close dry run, which prints the applying re-run.

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
- [`bearing doctor` reports every check it ran (ADR 0043)](../adr/0043-doctor-reports-every-check-it-ran.md) —
  why a passing check prints, and why the name changed.
- [Exit status is binary (ADR 0035)](../adr/0035-exit-status-is-binary.md) — why diagnostics, rather than a
  growing set of process statuses, distinguish failures.
