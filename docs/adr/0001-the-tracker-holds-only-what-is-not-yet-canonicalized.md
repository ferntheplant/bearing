# The tracker holds only what is not yet canonicalized

Bearing's tracker answers exactly one question: what has been committed to and not yet finalized into the repo?
An item leaves the moment its reasoning lands somewhere durable, and it leaves by being **deleted** — not
archived, not marked done, not moved to a completed folder. Closing is deletion, in the same change that lands
the work.

The alternative is the one every tracker takes: keep the record, add a status, and let the tool double as an
audit of what was done. That buys history nobody reads at the cost of the property that makes an in-the-moment
tool useful — that everything present is live. A tracker holding six months of closed work cannot answer "what
is outstanding" without a filter, and a filter is a thing people forget to apply. Git already holds the history,
and holds it better, because it holds the diff alongside it.

## Consequences

There is no completion state, no archive, and no recovery path inside bearing — see
[No archaeology (ADR 0017)](./0017-no-archaeology-git-remembers.md).

A growing tracker means something is not being written down properly. That is a signal worth having, and it
only works because deletion is the only exit.

The one record of a closed item that survives inside the tracker is its trail row — see
[The trail is append-only and a row is a pointer (ADR 0010)](./0010-the-trail-is-append-only-and-a-row-is-a-pointer.md).
