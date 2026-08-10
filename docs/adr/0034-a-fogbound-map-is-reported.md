# A fogbound map is reported

A map holding fog with no open design tickets is **fogbound**: it has run out of charted work while fog remains,
and the only thing that advances it is a mapping pass
([Mapping and walking alternate (ADR 0031)](./0031-mapping-and-walking-alternate.md)). Bearing reports it as a
status line above the frontier's three sections, and reports it even when BUILD and DECIDE are both empty.

Fogbound is the mirror of the fog-complete state in
[A map lives until its last ticket closes (ADR 0013)](./0013-a-map-lives-until-its-last-ticket-closes.md),
which named only one of the four combinations of fog and open design tickets. Left unreported, the missing one
is the worst failure the frontier has: a tracker where every map is fogbound and no build work is ready prints
an empty frontier, telling its caller there is nothing to do at the exact moment the next move is obvious.

It is a status rather than a fourth section because it is a starvation signal about a map, not a work item
competing for rank. Keeping it out of the sections is what preserves BUILD above DECIDE.

## Consequences

The trigger is **no open design tickets**, not no ready ones. A design ticket blocked on build work is ordinary
waiting, and BUILD already outranks DECIDE.

Fogbound is per map. Several maps can be fogbound while another has ready decisions, so it is reported for each
map rather than as a mode the whole tracker is in.
