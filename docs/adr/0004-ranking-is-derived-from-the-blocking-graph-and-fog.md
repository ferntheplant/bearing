# Ranking is derived from the blocking graph and fog

Bearing has no priority field, no severity, no points, and no task hierarchy. Work is ranked by how many other
tickets it transitively unblocks, and a design ticket additionally scores for each patch of fog it claims to
clear. Project scoping is the only grouping there is.

Priority integers are a number people assign once and never revisit, and hierarchy is a second structure to
maintain alongside the blocking graph that already encodes order. Both were rejected in favour of counting what
is already written down for other reasons. The fog term exists because the gate count alone is wrong in exactly
the case bearing is for: a design ticket whose purpose is to burn off three patches of fog blocks nothing
charted, and would otherwise rank zero.

## Consequences

Ranking cannot be overridden. If something should come first, the way to say so is to make the graph true —
which is usually a `blocked-by` edge that was missing anyway.

Counting fog is what gives `clears` a job beyond documentation, and is half the reason those links exist at all
— see [Fog links are advisory, not referential (ADR 0011)](./0011-fog-links-are-advisory-not-referential.md).
