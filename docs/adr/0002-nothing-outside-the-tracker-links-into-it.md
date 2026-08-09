# Nothing outside the tracker links into it

Source, decision records, and documentation cite durable artifacts. They never cite a ticket, a map, or a
backlog item. The tracker's own documentation and the skill bearing installs are the only exceptions, because
they have to know where it lives.

This falls out of [The tracker holds only what is not yet canonicalized (ADR 0001)](./0001-the-tracker-holds-only-what-is-not-yet-canonicalized.md):
every item is going to be deleted, so every link into one is a link that will break. The alternative — letting a
comment say "see ticket k2m9x4qp" — turns deletion into a breaking change and quietly converts the tracker into
permanent documentation, which is the state ADR 0001 exists to prevent.

## Consequences

An open question does not get recorded in durable prose as a link to where it is tracked. Where it does get
recorded — and when the answer is nowhere — is [`docs/README.md`](../README.md)'s business, not this ADR's.

The direction of reference is always tracker → repo. A ticket cites the artifacts that decided it; nothing cites
the ticket.
