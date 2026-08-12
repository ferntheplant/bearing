# The DECIDE section names maps, not destinations

A DECIDE group is headed by its project and fog count, and nothing else. It used to be headed by the map's
destination flattened to one line, which is a paragraph of prose — on this repository's own map, a heading
several hundred characters long, wrapped across a terminal, on the command an agent runs every turn. The
destination is what a map is for and belongs on the map; a heading's job is to say which map, and the fog count
already says how much of it is uncharted.

The value still carries the destination, so `--json` loses nothing and a later renderer can use it.

## Consequences

Two things the frontier did by accident are now decided, because the same heading is where both showed up. Groups
order by their most consequential ready decision, tie-broken by project name, which is the rule
[Ranking is derived from the blocking graph (ADR 0004)](./0004-ranking-is-derived-from-the-blocking-graph.md)
already applies inside a group; map filename order was nobody's choice. And a map whose design tickets are all
blocked prints no group at all rather than a bare heading: it has nothing to decide, its build tickets are still
in BUILD, and it is not starved, so
[A fogbound map is reported (ADR 0034)](./0034-a-fogbound-map-is-reported.md) does not apply either. That state
is ordinary waiting, and ordinary waiting is silent.
