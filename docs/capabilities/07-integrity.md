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
- **There is no `--fix`.** The warning prints the command that resolves it. Running that command applies its one
  named edit directly, which is more legible than a bulk-produced diff.
- **The warning stays meaningful.** The whole point of naming the fix is that nobody learns to ignore the
  output, which is also why there is only one warning left to ignore.
- **Deliberate, infrequent, and therefore allowed to be slow.** This is where a version check belongs, not on
  the frontier path.

## Where it stands

**Designed.** Nothing is built. Parse refusal, the error set, the single warning, and the no-bulk-fix rule are
settled.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **25** (every error class and the warning are reported) and
**26** (the warning carries the command that resolves it, and there is no bulk fix).

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
