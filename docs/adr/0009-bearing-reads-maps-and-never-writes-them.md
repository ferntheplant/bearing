# Bearing reads maps and never writes them

Maps are hand-edited prose. Bearing parses them — fog headings, the trail table — validates what it finds, and
never writes a byte back. Where a map needs changing, bearing prints what needs to change and stops.

The alternative is a tool that maintains the map: appends trail rows on close, strikes cleared fog, keeps a
table of contents current. Every one of those turns the single file with real merge-conflict potential into a
file two parties edit, and the reasoning a map holds is exactly the kind that does not survive being generated.
A destination, standing preferences, and a description of what is unclear are things a person writes because
writing them _is_ the thinking.

## Consequences

Closing a design ticket cannot clear the fog patch it burned off. Bearing prints the patch and says so; the edit
is the operator's. Same for the trail row, which must exist before a design ticket can close — bearing checks
for it rather than writing it.

Repointing a drifted fog link edits the **ticket**, never the map. See
[Anchor drift is detected and named, never repaired (ADR 0012)](./0012-anchor-drift-is-detected-and-named-never-repaired.md).

Policy — what counts as durable here, which skills a session should read — can live in the map's Notes as prose
precisely because nothing parses it.
