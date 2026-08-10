# Nothing points at a fog patch

A fog patch is not a link target. Tickets carry no `clears` field, the integrity pass has no drift diagnostic,
there is no repoint command, and the ranking has no fog term.

Linking is the obvious thing to do, and it was done first. A design ticket named the patches it intended to
clear, which bought two things: a ranking bonus for a ticket whose whole purpose was to burn off fog and which
therefore blocked nothing charted, and a reminder at close time that a patch still needed graduating.

Both stopped existing under
[Mapping and walking alternate (ADR 0031)](./0031-mapping-and-walking-alternate.md). Graduation happens in the
pass that consumes the patch, so there is nothing left to be reminded of when a ticket closes; and because the
pass consumes it, no live ticket ever has live fog to point at. What remained was a field that would dangle on
the normal case, and a drift warning that would fire on correct behaviour — which is how the two ended up
duplicating each other on this repo's own map, a patch kept alive only so its ticket's link would resolve.

Fog is still read. Patches are counted and listed, and a map holding fog with no open design tickets is fogbound
([A fogbound map is reported (ADR 0034)](./0034-a-fogbound-map-is-reported.md)). What a patch is not is
addressable.

## Consequences

Anchor slugs leave the on-disk format. The slugifier survives for the filename half of `<id>-<slug>.md`
([Three frontmatter fields, and the body is prose (ADR 0024)](./0024-three-frontmatter-fields-and-the-body-is-prose.md)),
but a fog heading is now prose a human links in prose, and nothing bearing stores depends on how it slugifies.

Design tickets rank on the blocking graph like everything else
([Ranking is derived from the blocking graph (ADR 0004)](./0004-ranking-is-derived-from-the-blocking-graph.md)),
which removes the one input that used to tell them apart.
