# A map holds intentions alongside fog

A map carries two lists of uncharted material, not one. `Not yet committed` holds **intentions** — things we are
fairly sure we want, where what they are is clear and only the commitment is missing. `Not yet specified` holds
**fog** — things where what we want is not clear enough to state. A mapping pass drains both.

The discriminator is certainty about _what_, never about size. An intention usually leaves a pass as a decision
landed on the spot or as a build ticket, because there is nothing left to ask; a patch of fog more often leaves
as a design ticket, because there is. Neither is a rank, and something can move from fog to intention in the
same session it was written.

This closes a hole [Mapping and walking alternate (ADR 0031)](./0031-mapping-and-walking-alternate.md) left. That
decision made the mapping pass the method's only ticket-producing ceremony, and the pass iterated fog alone —
so work that was specifiable from the start had no producer at all, and reached the tracker only as an
incidental byproduct of some design ticket resolving. Writing such work down as fog was already ruled out, since
it is not fog and charting it as fog produces exactly the patch-duplicating-a-ticket problem ADR 0031 rejected.
A second list is the answer that adds a producer without adding a ceremony.

## Considered options

**Redefining `Notes` as the intentions list.** Refused because Notes is the map's standing context — permanent
policy, read every session, never drained — and a pass that drained it would delete the project's own operating
instructions. `ABSTRACT.md` §2 also rests on it: policy living as prose in a map's notes is one of the three
layers bearing splits into.

**Letting a backlog item name a project**, which would make the backlog the per-project intentions list. Refused
because [Backlog items carry no frontmatter (ADR 0008)](./0008-backlog-items-carry-no-frontmatter.md) is what
makes capture free of ceremony, and a project field is the field that would start the erosion. The backlog stays
tracker-wide and unscoped; intentions that belong to a destination live on its map.

## Consequences

The map format gains a sixth section, ordered `Destination`, `Notes`, `Trail`, `Not yet committed`,
`Not yet specified`, `Out of scope` — descending certainty, from what is settled to what is excluded. Bearing
parses that format, so this is a change to the tool and not only to how maps are written.

**Charting a map means filling both sections.** The first pass over a loose idea sorts what you already intend
from what you cannot yet state, and that sorting is most of the value of writing a map at all.

`Not yet committed` is not a commitment, which is what separates it from a ticket. Nothing blocks on an entry
there, nothing ranks it, and deleting one costs nothing — the same properties fog has, applied to material whose
shape is already known.

The starvation signal is deliberately unchanged here.
[A fogbound map is reported (ADR 0034)](./0034-a-fogbound-map-is-reported.md) still derives from fog alone, so a
map with intentions and no fog reports nothing. Whether that is right is a live question and not one this
decision needs to answer to stand.
