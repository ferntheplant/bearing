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
- **Warnings, which mean something has drifted:** a fog link naming a heading that is no longer there, a trail
  row for a ticket that still exists.
- **There is no `--fix`.** Every warning prints the command that resolves it. Running that command applies its
  one named edit directly, which is more legible than a bulk-produced diff.
- **Drift gets a suggestion, never an edit.** For a broken fog link, the output names the closest current
  heading and the command that would repoint the ticket to it — with the target named explicitly, because a
  reworded heading and a cleared patch are indistinguishable to a tool.
- **Warnings stay meaningful.** The whole point of naming the fix is that nobody learns to ignore the output.
- **Deliberate, infrequent, and therefore allowed to be slow.** This is where a version check belongs, not on
  the frontier path.

## Where it stands

**Designed.** Nothing is built. Parse refusal, the integrity error and warning sets, and the no-bulk-fix rule are
settled.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **26** (every error and warning class is reported) and
**27** (every warning carries the command that resolves it, and there is no bulk fix).

## Decisions

- [Anchor drift is detected and named, never repaired (ADR 0012)](../adr/0012-anchor-drift-is-detected-and-named-never-repaired.md)
  — the pattern the whole command follows.
- [Three flat directories, and a project is a map file (ADR 0005)](../adr/0005-three-flat-directories-and-a-project-is-a-map-file.md)
  — why "a design ticket lives in a project" is a check here rather than a property of the filesystem.
- [Fog links are advisory, not referential (ADR 0011)](../adr/0011-fog-links-are-advisory-not-referential.md) —
  why one dangling pointer is an error and another is a warning.
- [Mutations are ordered, not atomic (ADR 0025)](../adr/0025-mutations-are-ordered-not-atomic.md) — why an
  interrupted apply tends toward the duplicate ids and dangling blockers this command reports.
- [Core exposes operations, not tracker internals (ADR 0027)](../adr/0027-core-exposes-operations-not-tracker-internals.md)
  — why malformed documents remain evidence in the one tracker read instead of stopping it at the first error.
