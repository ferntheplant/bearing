---
type: build
project: mvp
blockers: [n3dd4b]
---

# Parse a map's fog and trail behind `bearing fog`

## Background

Acquisition validates a map's six sections and that its destination is non-empty, and stops there. The contents
of `Not yet committed`, `Not yet specified`, and `Trail` are read as opaque text, so nothing downstream can count
a map's patches, find a trail row by id, or tell a fogbound map from a fog-complete one.

Three later tickets need this and cannot start without it: the frontier heads each DECIDE group with a
destination and fog count and reports fogbound maps, `bearing check` warns on a trail row whose ticket still
exists, and a design close prints its row verbatim.

[Bearing reads maps and never writes them (ADR 0009)](../../docs/adr/0009-bearing-reads-maps-and-never-writes-them.md)
bounds this: parsing only, no rewriting path.
[Nothing points at a fog patch (ADR 0033)](../../docs/adr/0033-nothing-points-at-a-fog-patch.md) says a patch has
no identity to preserve, so a heading is text and nothing more.

## Scope

Deepen acquisition's map parsing so an observation carries the destination text, the intentions, the fog
patches, and the trail rows, each retaining its exact source per
[Core exposes operations, not tracker internals (ADR 0027)](../../docs/adr/0027-core-exposes-operations-not-tracker-internals.md).
A trail row parses into the id it names, and its outcome cell retained verbatim so a later close can print it
unaltered.

Add the `bearing fog [<project>]` read operation and its command: the patches on one map, or across every map
when no project is named.

Out of scope: the fogbound and fog-complete states, which need open design tickets and belong to the frontier;
the trail-row warning, which belongs to `bearing check`; any interpretation of a patch's body.

## Done when

- A map holding a destination and one entry in either uncharted section validates as a project.
- Intentions and fog patches are parsed into separate lists, and an entry in one is never reported as the other.
- `bearing fog` lists every patch on the map, and rewording a patch's heading changes only the text printed.
- `bearing fog` reports fog only. Intentions are parsed and available, and this command does not print them
  ([A map holds intentions alongside fog (ADR 0039)](../../docs/adr/0039-a-map-holds-intentions-alongside-fog.md)).
- `bearing fog <project>` lists that map's patches; an unknown project exits 1 naming the maps that exist.
- A map with an empty `Not yet specified` parses, and `bearing fog` reports it as having no patches rather than
  failing.
- A trail row's outcome cell is retained byte-for-byte, including its Markdown links.
- A malformed trail row is a diagnostic on the observation rather than a thrown parse, so `bearing check` can
  accumulate it later.
- `bearing fog --json` emits the values it rendered.
- `vp run ready` passes from a clean checkout.
