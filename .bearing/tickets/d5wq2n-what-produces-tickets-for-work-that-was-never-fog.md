---
type: design
project: mvp
---

# What produces tickets for work that was never fog

**When a durable artifact already specifies work that no mapping pass will ever graduate, what step commits it
to the tracker — and is that step part of the method or outside it?**

Two rules leave a category of work with no producer.
[Mapping and walking alternate (ADR 0031)](../../docs/adr/0031-mapping-and-walking-alternate.md) makes the
mapping pass the method's only ticket-producing ceremony, and it iterates over the fog patches a map holds. This
map's Notes then rule that specifiable work is never charted as fog. Work that was specified up front therefore
has no patch to graduate from, and reaches the tracker only as an incidental byproduct of some design ticket
resolving — which is how every build ticket here has been born so far.

The evidence is in this repository. Roughly twenty of the twenty-seven criteria in
[`ABSTRACT.md`](../../ABSTRACT.md) §8 have no code, four capabilities stand at Designed, and the tracker holds
two open tickets, neither of which builds a capability. Once both close the map is fog-complete rather than
fogbound, so [A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) reports
nothing, correctly — and bearing goes silent with most of itself unbuilt. The backlog item
`fag86k` is the same gap seen from the other side: it has waited on "a tracker with real spread" that the method
never produces.

Two answers are already excluded. Bearing cannot read §8 and derive the remainder, because it knows nothing
about how a repo validates itself
([Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md)). And the
ancestor method's step — create every statable ticket during initial mapping — is the option ADR 0031 considered
and rejected, because it produced fog patches duplicating live tickets almost word for word. Whatever this
settles on must not reintroduce that duplication.

Worth testing by doing rather than by reasoning: decompose the unbuilt criteria here for real, against §7's
build order, and watch what the act actually requires — whether it is a phase, a triage verdict, an ordinary use
of the backlog, or something the method should stay out of.

Settles as an ADR, most likely an amendment to ADR 0031 if the decision it records is unchanged and only the
consequence drawn from it was incomplete. The answer has to reach the wayfinder skill's text, which is why it
blocks `x8bq3t`.
