# Capture

Getting something out of your head and into the repository with no ceremony at all. This is the front door: one
command, one argument, no fields to fill in and no decision to make. Everything downstream in this catalogue
starts with something captured here or with a commitment made directly.

## What you can expect

- **`bearing backlog "..."` writes an item and gets out of the way.** No type, no project, no priority, no
  status. Being in the backlog is the item's whole status.
- **Length is not a filter.** A three-word note and a full bug report with reproduction steps, failing output,
  and the file you suspect are both backlog items. Write everything you have while you have it — what is missing
  from a backlog item is a decision about size and lane, not information.
- **`bearing backlog` with no argument lists the backlog**, which is what you want immediately before triage.
- **Items get an id at creation**, so triage has a handle to name, and that id survives everything that happens
  to the item afterwards.
- **Fog you cannot place lives here too.** Something you cannot specify and cannot yet attach to any destination
  waits in the backlog until a destination can be named.
- **The backlog is not a hygiene metric.** It is where projects come from, and leaving something in it is a
  verdict.

## Where it stands

**Designed.** Nothing is built. The command shape, the no-frontmatter format, and the scoping test are settled.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **3** (one command, an id, no frontmatter) and **4** (bare
invocation lists the backlog).

## Decisions

- [Backlog items carry no frontmatter (ADR 0008)](../adr/0008-backlog-items-carry-no-frontmatter.md) — why
  scoping rather than volume is the test, and why unmoored fog waits here.
- [The filename is the only place an id appears (ADR 0006)](../adr/0006-the-filename-is-the-only-place-an-id-appears.md)
  — why an item can be captured with no fields and still have identity.
