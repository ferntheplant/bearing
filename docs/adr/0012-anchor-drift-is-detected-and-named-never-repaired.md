# Anchor drift is detected and named, never repaired

Maps are hand-edited, so fog headings get reworded and every ticket pointing at the old text goes dangling. Left
alone this rots quietly: warnings accumulate, everyone learns to ignore them, and fog silently stops counting
toward ranking.

So the integrity pass detects drift, offers the closest current heading as a suggestion, and prints the exact
command that repoints the ticket. It never applies the fix itself.

The reason is that **"heading reworded" and "heading removed because the fog cleared" produce an identical
dangling pointer**, and only the operator knows which happened. An automatic repair would guess, and it would
guess wrong precisely when a project is moving fastest. The fuzzy match is a suggestion in output; the target
heading is named explicitly on the command line, so applying it is a decision someone made rather than one
bearing made for them.

## Consequences

The repointing command edits the ticket's frontmatter, never the map —
[Bearing reads maps and never writes them (ADR 0009)](./0009-bearing-reads-maps-and-never-writes-them.md) holds.

A warning left in place stays meaningful, which is the property the whole mechanism exists to protect.

This is the pattern for the integrity pass generally: it has no bulk-fix flag, and every warning prints the
command that resolves it. The operator ends up with commands they chose and can read back, rather than a diff a
flag produced.
