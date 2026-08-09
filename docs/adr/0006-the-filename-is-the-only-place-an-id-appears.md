# The filename is the only place an id appears

Every item is named `<id>-<slug>.md`. The id appears nowhere inside the file, so it cannot desync from the
filename, and the slug is derived from the title rather than being independent of it.

The obvious alternative — an `id:` field in frontmatter — creates two sources of truth for the same fact and
guarantees they eventually disagree, usually after a copy-paste. Putting identity in the name also makes the
tracker navigable with the tools people already have: a file picker, a glob, `ls`.

## Consequences

**Bearing owns retitling.** Changing a title changes the filename, and doing that by hand is how you get an id
whose slug lies. The retitle command exists for that reason and not for convenience.

The id survives everything else: promotion out of the backlog, retitles, project changes. It is identity for
life.

Unambiguous id prefixes are accepted everywhere an id is, so three or four characters is usually enough to type.
That is only affordable because ids are never stored inside files — a prefix that becomes ambiguous later
affects a command line, not a data structure. It is also the reason a forensic lookup by full id is not
something bearing can offer; see [No archaeology (ADR 0017)](./0017-no-archaeology-git-remembers.md).
