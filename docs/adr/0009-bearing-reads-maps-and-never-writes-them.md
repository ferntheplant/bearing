# Bearing reads maps and never writes them

Maps are hand-edited prose. Bearing parses them — fog headings, the trail table — validates what it finds, and
never writes a byte back. Where a map needs changing, bearing prints what needs to change and stops.

The alternative is a tool that maintains the map: appends trail rows on close, strikes cleared fog, keeps a
table of contents current. Every one of those turns the single file with real merge-conflict potential into a
file two parties edit, and the reasoning a map holds is exactly the kind that does not survive being generated.
A destination, standing preferences, and a description of what is unclear are things a person writes because
writing them _is_ the thinking.

## Consequences

Every edit a map needs is the operator's: the fog a ticket revealed, the patches a mapping pass consumed, and
the trail row that must exist before a design ticket can close. Bearing checks for the row rather than writing
it.

Policy — what counts as durable here, which skills a session should read — can live in the map's Notes as prose
precisely because nothing parses it.
