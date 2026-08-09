# Fog links are advisory, not referential

A design ticket points at the fog it intends to clear by naming the map heading, written at creation with no
second wiring pass. A link naming a heading that no longer exists **warns and never fails** — unlike a dangling
project or a dangling blocker, both of which are errors.

That looseness is the decision. Fog gets rephrased and fog gets cleared, and both are normal; making the link
referential would mean fog needs ids, a lifecycle, and partial-graduation tracking, which is a second tracker
inside the tracker for material that is by definition not yet sharp enough to track.

Two things the links buy, and they are the whole justification:

- **Ranking that is not wrong.** Transitive gate count only sees charted dependents, so a design ticket whose
  purpose is to burn off three patches of fog would otherwise score zero. See
  [Ranking is derived from the blocking graph and fog (ADR 0004)](./0004-ranking-is-derived-from-the-blocking-graph-and-fog.md).
- **A reminder at the right moment.** Closing a ticket that claimed to clear a patch puts the patch on screen.
  Graduation is the step that gets skipped, and closing is the only moment anyone is looking at both the answer
  and the patch.

## Consequences

Fog headings double as anchors that resolve in editors and in a web view, so tickets can also link fog in prose.
That is what makes heading text load-bearing, and therefore what makes drift a problem worth detecting — see
[Anchor drift is detected and named, never repaired (ADR 0012)](./0012-anchor-drift-is-detected-and-named-never-repaired.md).
