# Structure in the map is written only at completion

The map's one structured section is the trail, and a row is written only when the ticket it records is closing.
Nothing structured is created in advance: no row for a ticket that is still open, no link to a patch that is
still fog.

Anything written ahead of completion has to encode a not-yet state, and bearing has no status field — existence
is the status ([Two ticket types, discriminated by how they close (ADR 0007)](./0007-two-ticket-types-discriminated-by-how-they-close.md)).
It also breaks the check that justifies the structure in the first place: a design close refuses on an empty
trail outcome, and if every row starts empty then empty is the normal case and the refusal stops meaning
anything.

## Considered options

Writing the trail rows during a mapping pass, to document the batch it produced. Besides the empty-outcome
problem, it puts open tickets on the map — a second place to keep in step with the tracker, which
[The frontier is derived, never stored (ADR 0003)](./0003-the-frontier-is-derived-never-stored.md) exists to
prevent — and orders the rows by creation rather than by closing, which makes the table a plan of what is
intended rather than a record of what was walked.

## Consequences

This is the general form of the argument that removes fog links: a field pointing from a live ticket at live fog
is structure written before completion, and it dangles on the normal case. See
[Nothing points at a fog patch (ADR 0033)](./0033-nothing-points-at-a-fog-patch.md).

It also sharpens an existing warning. A trail row for a ticket that still exists was drift; it is now a direct
violation of this decision, and it is the only warning
[the integrity pass](../capabilities/07-integrity.md) has left.
