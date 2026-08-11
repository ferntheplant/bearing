# Capture

Getting something out of your head and into the repository with no ceremony at all. This is the front door: one
command, one argument, no fields to fill in and no decision to make. Everything downstream in this catalogue
starts with something captured here or with a commitment made directly.

## What you can expect

- **`bearing backlog "..."` writes an item and gets out of the way.** No type, no project, no priority, no
  status, and no dry run. Being in the backlog is the item's whole status. The one argument is the item's title:
  the file is `backlog/<id>-<slug>.md` whose body is `# <title>` and nothing else, and prose is added or edited
  directly afterwards ([Tracker files are edited directly (ADR 0030)](../adr/0030-tracker-files-are-edited-directly.md)).
- **A title that cannot become a filename does not fail the capture.** If nothing survives slugification — or the
  title is a single word too long to truncate at a hyphen — the file is written as `untitled` rather than
  rejected, so the item is never lost.
- **Length is not a filter.** A three-word note and a full bug report with reproduction steps, failing output,
  and the file you suspect are both backlog items. Write everything you have while you have it — what is missing
  from a backlog item is a decision about size and lane, not information.
- **`bearing backlog` with no argument lists the backlog**, which is what you want immediately before triage.
- **Items get an id at creation**, so triage has a handle to name, and that id survives everything that happens
  to the item afterwards. The id is minted against the ids already in the tracker, so a capture never collides
  with an item that is already there.
- **Fog you cannot place lives here too.** Something you cannot specify and cannot yet attach to any destination
  waits in the backlog until a destination can be named.
- **The backlog is not a hygiene metric.** It is where projects come from, and leaving something in it is a
  verdict.

## Where it stands

**Built.** `bearing backlog "..."` plans and applies a capture in one invocation, writing the title as a heading
with no frontmatter; bare `bearing backlog` lists the backlog. The slug rule, the id rule, and the clock-based
minting are implemented and tested.

## Decisions

- [Backlog items carry no frontmatter (ADR 0008)](../adr/0008-backlog-items-carry-no-frontmatter.md) — why
  scoping rather than volume is the test, and why unmoored fog waits here.
- [The filename is the only place an id appears (ADR 0006)](../adr/0006-the-filename-is-the-only-place-an-id-appears.md)
  — why an item can be captured with no fields and still have identity.
- [Only design-ticket closing is a dry run (ADR 0029)](../adr/0029-only-design-ticket-closing-is-a-dry-run.md) —
  why capture writes its generated id and item in one invocation.
- [Ids are minted from the clock, not a random source (ADR 0040)](../adr/0040-ids-are-minted-from-the-clock.md) —
  why the id comes from the clock and the collision check, not from a random generator.
