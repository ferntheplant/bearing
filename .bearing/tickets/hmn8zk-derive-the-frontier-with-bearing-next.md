---
type: build
project: mvp
blockers: [ja2j4z, 3j66kq]
---

# Derive the frontier with `bearing next`

## Background

This is the command bearing exists to make good and the one an agent runs on every turn
([The frontier](../../docs/capabilities/05-the-frontier.md)). Both of its inputs land before it: the fog and
trail parsed by `ja2j4z`, and the blocking graph derived by `3j66kq`. What remains is ranking, the three
sections, and the fogbound status line.

[A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) is the part most
easily got wrong: the trigger is no **open** design tickets rather than no ready ones, it is per map rather than
a mode the tracker is in, and it must print when BUILD and DECIDE are both empty — which is exactly the case an
implementation built against a busy tracker never sees.

## Scope

Derive ranking as transitive gate count and nothing else
([ADR 0004](../../docs/adr/0004-ranking-is-derived-from-the-blocking-graph.md)), assemble the frontier value —
BUILD, DECIDE grouped by project, TRIAGE as a count, and the fogbound maps — and render it as both the default
command and `bearing next`.

Out of scope: any tiebreaker beyond gate count. Where gate counts tie the order is arbitrary and stays that way;
`fag86k` in the backlog holds the question of whether it should.

## Done when

- `bearing next` prints BUILD, DECIDE, and TRIAGE in that order, with TRIAGE a count.
- A ticket with an unsatisfied blocker is absent from BUILD, and deleting the blocker file is the only edit
  needed to make it present.
- Between two ready tickets the one transitively unblocking more ranks higher, and a map with no fog and no open
  design tickets is absent from DECIDE while its build tickets remain.
- A map with fog and no open design ticket prints as fogbound above the sections, including when BUILD and
  DECIDE are both empty.
- A design ticket blocked by a build ticket keeps its map out of the fogbound report, because the map still has
  an open design ticket.
- Each DECIDE group is headed by its map's destination and fog count.
- Bare `bearing` and `bearing next` render the same value, and `--json` emits it.
- `NO_COLOR` produces the same bytes as an unset environment, which holds trivially while nothing colours.
- `vp run ready` passes from a clean checkout.
