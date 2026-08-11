---
type: build
project: mvp
blockers: [twwbzc]
---

# Promote and drop items with `bearing triage`

## Background

Triage is where something stops being a finding and becomes a commitment. Four of the five verdicts in
[Triage](../../docs/capabilities/02-triage.md) are the same move — out of `backlog/` and into `tickets/`,
differing only in frontmatter — and the fifth, leaving the item alone, is not a command at all.

Promotion is ordered like a retitle: the ticket is written before the backlog item is deleted, so an interrupted
triage fails toward a duplicate id that resolution and `bearing check` reject rather than toward the item
disappearing ([Mutations are ordered, not atomic (ADR 0025)](../../docs/adr/0025-mutations-are-ordered-not-atomic.md)).

## Scope

Add `bearing triage <id> --to <project> | --ticket | --drop`, one id at a time. The item's body carries across
unchanged and its id survives; only frontmatter is added.

Out of scope: creating a map. Verdict 4 is writing a map file by hand, and bearing never writes a map
([Bearing reads maps and never writes them (ADR 0009)](../../docs/adr/0009-bearing-reads-maps-and-never-writes-them.md)).
There is no bulk mode and no multi-id form.

## Done when

- `--ticket` promotes an item to an unprojected build ticket with the id unchanged.
- `--to <project>` promotes it into an existing map with the id unchanged and nothing but frontmatter differing
  from the backlog item.
- `--drop` deletes the item.
- `--to` with a name no map carries exits 1 naming the maps that exist, and deletes nothing.
- Triaging an id that resolves to a ticket rather than a backlog item exits 1 saying so.
- Two verdict flags together exit 1; no verdict flag exits 1.
- The promoted ticket is written before the backlog item is unlinked.
- Each verdict applies on its first invocation with no dry run.
- `vp run ready` passes from a clean checkout.
