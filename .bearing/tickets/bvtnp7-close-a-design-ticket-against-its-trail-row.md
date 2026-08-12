---
type: build
project: mvp
---

# Close a design ticket against its trail row

## Background

This is the one mutation that changes nothing on its first invocation
([Only design-ticket closing is a dry run (ADR 0029)](../../docs/adr/0029-only-design-ticket-closing-is-a-dry-run.md)).
Bearing can check that a trail outcome exists but cannot judge whether it is true, so it puts the row on screen
before deleting anything — and a row written three commits ago and since invalidated passes an existence check
and fails anyone who reads it, which is why the row is shown verbatim rather than merely checked.

The mechanism depends on a flag being learnable only from the dry run's own output
([The confirmation flag is undocumented on purpose (ADR 0016)](../../docs/adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)).
**That ADR is currently short its own subject: nothing in this repository actually spells the flag, though the
ADR says the repository is where it is documented.** Settling the spelling and recording it in ADR 0016 is part
of this ticket's scope, and CI's guard against it leaking is `66r5rr`.

## Scope

Add the design-close plan — the trail row, the file to delete, and the tickets it would unblock — as a value
core returns ([Core returns values (ADR 0019)](../../docs/adr/0019-core-returns-values-only-the-cli-renders.md)),
render it as the dry run, and apply it under the flag. Amend ADR 0016 to name the flag it is about.

Out of scope: closing a map. Nothing here writes to a map — the trail row is read, and the human wrote it.

## Done when

- A bare `bearing close <id>` on a design ticket prints the ticket, the trail row **verbatim**, the file it
  would delete, and the tickets it would unblock, and changes nothing on disk.
- Re-running the same command with the applying flag deletes the file and strips the id from every blocker list.
- Closing refuses when the map has no trail row for the id, and refuses when the row exists with an empty
  outcome.
- Closing refuses when the ticket names a project no map carries.
- The rendered row is byte-identical to the map's source for that row, including its Markdown links.
- The applying flag appears in the dry run's output and in ADR 0016, and in no help text, no error message, and
  no shipped skill.
- `--json` on the dry run emits the same plan value the text rendering used.
- `vp run ready` passes from a clean checkout.
