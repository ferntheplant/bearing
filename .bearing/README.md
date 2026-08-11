# This tracker

`.bearing/` holds what has been committed to and not yet finalized into this repository: untriaged items in
`backlog/`, commitments in `tickets/`, and one map per project in `maps/`. Nothing here is a record of what
happened — closing anything is deleting it, and git holds the history with the diff attached.

This file is the bridge between the tracker and the rest of the repository. It says where an answer has to land
before the ticket that asked the question is allowed to leave, and it holds for every map here. Policy that is
true of one project only lives in that map's **Notes**.

## What counts as durable here

A design ticket may close when its answer lands in one of five places:

- an ADR under [`docs/adr/`](../docs/adr/);
- an edit to a file in [`docs/capabilities/`](../docs/capabilities/);
- a term in [`CONTEXT.md`](../CONTEXT.md);
- an entry in [`docs/gotchas.md`](../docs/gotchas.md);
- a change to [`ABSTRACT.md`](../ABSTRACT.md).

Nothing else counts — not a commit message, not a PR comment, not a paragraph in a map. A trail row points at
one of those five, or the ticket is not finished.

## Read before working a ticket

[`ABSTRACT.md`](../ABSTRACT.md) for what the whole thing is, the capability file for the area being touched, and
the ADRs that capability links. Then the map's own **Notes**, which carry only what is true of that project.

[`CONTEXT.md`](../CONTEXT.md) is binding vocabulary, not a reference: a ticket is not an issue, a project is a
map, closing is deleting, the trail is not a route.

## Skills to consult

`domain-modeling` whenever the model or the durable docs change — which is most design tickets, since closing one
means writing one of the five homes above. `codebase-design` whenever a seam is being placed.
