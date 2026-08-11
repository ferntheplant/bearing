---
type: build
project: mvp
blockers: [5qdg2x]
---

# Close a map, refusing while a ticket names it

## Background

A map outlives its own fog and stays until its last ticket closes, because its trail is what the remaining build
work rests on ([A map lives until its last ticket closes (ADR 0013)](../../docs/adr/0013-a-map-lives-until-its-last-ticket-closes.md)).
Closing it applies immediately: by the time nothing names it, every trail row already points at something
durable, so there is nothing left to write out on the way.

It stays a flag rather than an overload of `close <id>` because resolving one argument as either an id or a map
name would make the hundred-times-more-common case ambiguous to save a flag on the rare one
([Closing](../../docs/capabilities/06-closing.md)).

## Scope

Add `bearing close --map <project>`: refuse while any ticket carries that project, otherwise delete the map file
on that invocation.

Out of scope: anything conditional on the map's fog or trail contents. A fogbound map with no tickets closes;
the fog dies with it, and that is the human's call to make.

## Done when

- `bearing close --map <project>` refuses while any ticket names the map, exits 1, names the tickets that do,
  and deletes nothing.
- With no ticket naming it, the map file is deleted on the first invocation with no dry run.
- A project name no map carries exits 1 naming the maps that exist.
- `--map` takes a map's filename stem and does not accept an id prefix, and `close <id>` never resolves an
  argument to a map.
- Closing a map edits no other file.
- `vp run ready` passes from a clean checkout.
