# Three flat directories, and a project is a map file

The tracker is three flat directories — untriaged items, every ticket, and every map. A project has no
directory: **a project _is_ a map file**, and a ticket belongs to one by naming its slug-safe stem in
frontmatter. Its filename follows the shared slug grammar in
[Three frontmatter fields, and the body is prose (ADR 0024)](./0024-three-frontmatter-fields-and-the-body-is-prose.md).

The rejected alternative nested tickets under a per-project directory, making membership a path. Two things were
wrong with it. Promotion became a move across directory levels, so the cheapest triage verdict was the most
disruptive edit. And the map ended up in a directory whose only other content was the tickets the map
deliberately does not list — a layout that implies a table of contents the design had already rejected.

Flat, the map is the whole of the project: destination, fog, trail. Membership is a one-word edit, and a file
move survives in exactly one place, out of the backlog and into tickets.

## Consequences

"A design ticket lives only in a project" becomes a check rather than a property of the filesystem. That is a
cheap check, and it is one of the integrity pass's errors.

Project membership is referential: a ticket naming a map that does not exist is an error, not a warning. This is
safe because a map's slug is human-chosen and stable, unlike an item slug derived from a title. The restricted
grammar also keeps the same project name safe to type at the shell and serialize as a YAML string.
