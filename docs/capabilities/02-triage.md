# Triage

Deciding what a captured item costs and where it belongs. Triage is the moment something stops being a finding
and becomes a commitment — or is deleted, or is deliberately left alone. It is also the only place new projects
come from.

## What you can expect

- **Five verdicts, and the cheapest one that fits wins:**
  1. **Delete it** — not real, already fixed, duplicate.
  2. **A build ticket with no project** — specifiable now, no map owns it.
  3. **A ticket belonging to a project** — design or build, attached to a live map.
  4. **A new map** — a nameable destination plus at least one thing you cannot yet specify.
  5. **Leave it** — unmoored fog, waiting for a destination.
- **Every verdict but the first is the same move**, out of the backlog and into tickets, differing only in what
  the ticket says about itself. Nothing moves across directory levels and nothing is renamed.
- **The item's id survives triage**, so anything you wrote down referring to it still resolves.
- **An interrupted triage fails toward duplication, not disappearance.** The promoted ticket is written before
  the backlog item is deleted, so interruption between them leaves a duplicate id that resolution and
  `bearing check` reject.
- **Stub maps are allowed.** A destination and one patch of fog is a legitimate map. One patch and no
  destination is verdict 5 — the destination is what draws the line, because naming one is the actual work.
- **`bearing triage <id>` takes the verdict as a flag**, so triaging a backlog in one sitting is a series of
  short commands rather than a form. Each command applies its verdict immediately.
- **One id at a time, on purpose.** There is no bulk mode and no multi-id form. The verdict set is small enough
  that a series of single-id commands is genuinely fast, and the only thing bulk triage would speed up is
  triaging without reading — which is the failure this step exists to prevent.

## Where it stands

**Designed.** Nothing is built. The verdict set, the stub-map threshold, and the promotion mechanics are
settled.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **5** (promotion to an unprojected build ticket), **6**
(promotion into an existing map, id unchanged) and **7** (dropping an item).

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
