---
type: build
project: mvp
blockers: [n3dd4b, 5sg7nk]
---

# Filter tickets with `bearing ls`

## Background

Bare `bearing` currently prints every ticket unfiltered, which was scaffolding for exercising the seam rather
than a command anyone asked for — the default is supposed to be the frontier. `bearing ls` is where listing
actually lives.

Two of its filters need the blocking graph, which nothing derives yet. A ticket is unblocked when every id it
names no longer exists, so an absorbed or invalidated blocker is a satisfied one
([Ranking is derived from the blocking graph (ADR 0004)](../../docs/adr/0004-ranking-is-derived-from-the-blocking-graph.md)).
Building the graph here rather than inside the frontier keeps it reachable one ticket earlier, and the frontier
then only adds ranking on top.

One filter the [tickets capability](../../docs/capabilities/03-tickets.md) promises — a query — has no stated
meaning, and neither does whether the listing groups by project. Both are fog on this map and deliberately not
in this ticket's scope.

## Scope

Derive the blocking graph in core's analysis: for each ticket, which named blockers still exist, and the
transitive closure both ways. Expose readiness through it.

Add `bearing ls [--build|--design|--blocked|--ready|--project X|--json]`, and move bare `bearing` off ticket
listing so the default command is free for the frontier.

Out of scope: the query filter and any grouping of the output; ranking and the frontier's three sections; every
mutation.

## Done when

- `--build`, `--design`, `--project X`, `--ready`, and `--blocked` each filter as named, and combining them
  intersects rather than erroring.
- A ticket naming a blocker id that no longer exists is `--ready`, not `--blocked`.
- A blocker cycle does not hang or overflow; it is reported as a refusal naming the ids in it.
- `--project` with a name no map carries exits 1 naming the maps that exist.
- `bearing ls --json` emits the values it rendered.
- The transitive closure is a core value; `apps/cli` receives it and renders.
- Bare `bearing` no longer prints the ticket list, and its test coverage moves to `bearing ls`.
- `vp run ready` passes from a clean checkout.
