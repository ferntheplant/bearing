# A map lives until its last ticket closes

A map has two endings, and collapsing them into one was a mistake worth recording.

**Fog-complete** is when a map has no unspecified patches left and no design ticket names it. It has stopped
being a decisioning instrument: there is nothing left to chart, and it will never appear among the decisions
that are ready again.

But it is not finished, because the trail is still load-bearing. The build tickets that fell out of those
decisions are still open, and every one of them was written by someone standing on a chain of resolved
questions. A builder picking one up wants the destination for what this is all for, the notes for the standing
preferences, and above all the trail for what was already settled and why the ticket says what it says. Deleting
the map at fog-completion would delete exactly the context the remaining work needs, at exactly the moment the
people doing that work are furthest from the conversation that produced it.

So a map lives until nothing names it. Closing it is then the same operation as closing anything else, with no
special case: it refuses while any ticket still belongs to it, and otherwise deletes the file.

## Consequences

**Project membership stays on build tickets for their whole life**, which is what earns that field its place.
It is not decoration for filtered listing; it is how the tracker knows a map is still needed, and it is the
pointer a builder follows from a ticket to the reasoning behind it.

A fog-complete map goes quiet before it goes away — it drops out of the decision frontier while its build
tickets are still running.

The opposite state, fog remaining with no open design ticket, is **fogbound**, and it is reported rather than
silent — see [A fogbound map is reported (ADR 0034)](./0034-a-fogbound-map-is-reported.md). Between them the two
name every combination of fog and open decisions a map can be in.

**There is no durable home for a closed map.** No archive directory, no export on the way out. By the time a map
can close, every trail row already points at an artifact that outlives it, so the map's copy is a duplicate of
pointers. Keeping it would give the repo a second place where decisions appear to live, which is
[Nothing outside the tracker links into it (ADR 0002)](./0002-nothing-outside-the-tracker-links-into-it.md) failing
from the inside.

Closing a map touches exactly one file, because the membership field outlives the fog rather than being stripped
at fog-completion.
