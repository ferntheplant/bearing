# Two ticket types, discriminated by how they close

Bearing ships two ticket types, and the whole discriminator is one sentence:

> A design ticket closes as an artifact. A build ticket closes as a commit.

Manual work that unblocks a decision — provisioning access, signing up for a service so its API can be judged —
is design, because its outcome is knowledge. Finer-grained method (is this settled by conversation? by a rough
prototype? by reading third-party docs?) is written into the ticket body by whoever writes it. Bearing does not
model it.

The rejected alternative was the ancestor's type vocabulary, which encoded method as types. Those turned out to
be the names of that repo's own skills rather than properties of the work, so shipping them would have shipped
one repo's method as another repo's mechanism.

There is also **no status field**. A ticket goes from existing to deleted in a single change, so `open` was the
only value it could ever hold, and a field with one value is not a field.

## Consequences

The two types are checked asymmetrically at closing time, because they have structurally different evidence: a
build ticket's evidence is the diff it ships with, and a design ticket's is a different file that no tool can
derive. See
[Only design-ticket closing is a dry run (ADR 0029)](./0029-only-design-ticket-closing-is-a-dry-run.md).

Design tickets always name a project; build tickets may not. So the set of tickets with no project is always
directly actionable — work that was specifiable from the start and that no map ever owned.
