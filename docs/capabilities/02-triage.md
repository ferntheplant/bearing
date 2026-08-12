# Triage

Deciding what a captured item costs and where it belongs. Triage is the moment something stops being a finding
and becomes a commitment — or is deleted, or is deliberately left alone. It is also the only place new projects
come from.

## What you can expect

- **Five verdicts, and the cheapest one that fits wins:**
  1. **Delete it** — not real, already fixed, duplicate.
  2. **A build ticket with no project** — specifiable now, no map owns it.
  3. **A build ticket in a project** — specifiable now, and a live map owns it. A finding that is really a
     question belongs on a map as a design ticket, written directly with `bearing add design --project`
     after reading it ([Triage promotes into build tickets (ADR 0045)](../adr/0045-triage-promotes-into-build-tickets.md)).
  4. **A new map** — a nameable destination plus at least one thing you intend or cannot yet specify.
  5. **Leave it** — unmoored fog, waiting for a destination.
- **Every verdict but the first is the same move**, out of the backlog and into tickets, differing only in what
  the ticket says about itself. Nothing moves across directory levels and nothing is renamed.
- **The item's id survives triage**, so anything you wrote down referring to it still resolves.
- **An interrupted triage fails toward duplication, not disappearance.** The promoted ticket is written before
  the backlog item is deleted, so interruption between them leaves a duplicate id that resolution and
  `bearing doctor` reject.
- **Stub maps are allowed.** A destination plus a single entry — an intention or a patch of fog, either one — is
  a legitimate map. That entry with no destination is verdict 5: the destination is what draws the line, because
  naming one is the actual work.
- **`bearing triage <id>` takes the verdict as a flag** — `--ticket` for a build ticket with no project,
  `--to <project>` for one attached to a map, `--drop` to delete. No verdict flag, or more than one, exits 1.
  Each command applies its verdict immediately, so triaging a backlog in one sitting is a series of short
  commands rather than a form.
- **One id at a time, on purpose.** There is no bulk mode and no multi-id form. The verdict set is small enough
  that a series of single-id commands is genuinely fast, and the only thing bulk triage would speed up is
  triaging without reading — which is the failure this step exists to prevent.

## Where it stands

**Built.** `bearing triage <id>` takes one verdict flag and applies it immediately, resolving the id by prefix
and refusing one that is already a ticket. `--ticket` promotes the item to a projectless build ticket and
`--to <project>` promotes it into the named map, with the id and slug unchanged and only frontmatter added to
the body; `--drop` deletes the item. The promoted ticket is written before the backlog item is unlinked.
`--to` naming a map no file carries names the maps that exist and deletes nothing. Verdict 4 is not a command
— a new map is written by hand, because bearing never writes a map
([Bearing reads maps and never writes them (ADR 0009)](../adr/0009-bearing-reads-maps-and-never-writes-them.md))
— and verdict 5, leaving the item alone, is calling nothing.

## Decisions

- [Three flat directories, and a project is a map file (ADR 0005)](../adr/0005-three-flat-directories-and-a-project-is-a-map-file.md)
  — why promotion is a one-word edit rather than a move between directory levels, and why the cheapest verdict
  is not the most disruptive one.
- [Two ticket types, discriminated by how they close (ADR 0007)](../adr/0007-two-ticket-types-discriminated-by-how-they-close.md)
  — the test that picks between verdicts 2 and 3.
- [Backlog items carry no frontmatter (ADR 0008)](../adr/0008-backlog-items-carry-no-frontmatter.md) — why
  verdict 5 is a real answer.
- [Mutations are ordered, not atomic (ADR 0025)](../adr/0025-mutations-are-ordered-not-atomic.md) — the failure
  contract when promotion stops between its two filesystem operations.
- [Only design-ticket closing is a dry run (ADR 0029)](../adr/0029-only-design-ticket-closing-is-a-dry-run.md) —
  why a triage command plans and applies its verdict in one invocation.
- [Triage promotes into build tickets (ADR 0045)](../adr/0045-triage-promotes-into-build-tickets.md) — why
  neither promote verdict ever writes a design ticket.
