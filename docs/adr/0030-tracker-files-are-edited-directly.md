# Tracker files are edited directly

Bearing has no `edit` command. Ticket bodies and frontmatter, backlog prose, and maps are ordinary Markdown that
the user edits with their own tools. Bearing reads and checks those edits; it does not choose or launch an
editor.

An edit command would either be a path-printing alias that saves nothing or would need the subprocess dependency
bearing deliberately excludes. Direct editing is already the ownership model for maps, and applying it to every
tracker file leaves one necessary exception: `bearing retitle` still owns filename changes because the filename
carries the id and derived slug.
