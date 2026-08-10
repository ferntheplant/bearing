# Ranking is derived from the blocking graph

Bearing has no priority field, no severity, no points, and no task hierarchy. Work is ranked by how many other
tickets it transitively unblocks, and by nothing else. Project scoping is the only grouping there is.

Priority integers are a number people assign once and never revisit, and hierarchy is a second structure to
maintain alongside the blocking graph that already encodes order. Both were rejected in favour of counting what
is already written down for other reasons.

## Consequences

Ranking cannot be overridden. If something should come first, the way to say so is to make the graph true —
which is usually a blocker edge that was missing anyway.

A freshly created batch of tickets has no order at all until its blockers are wired. That is what makes the
second sweep of a mapping pass load-bearing rather than tidy — see
[Mapping and walking alternate (ADR 0031)](./0031-mapping-and-walking-alternate.md).
