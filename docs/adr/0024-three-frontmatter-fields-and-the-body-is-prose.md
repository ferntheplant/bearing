# Three frontmatter fields, and the body is prose

A ticket is a Markdown file with YAML frontmatter carrying exactly three possible fields, and a body bearing does
not parse. This records the on-disk format that
[The filename is the only place an id appears (ADR 0006)](./0006-the-filename-is-the-only-place-an-id-appears.md)
assumes and never states.

## The name

`<id>-<slug>.md`, in `backlog/`, `tickets/`, or `maps/`.

The **id** is six characters of Crockford base32 (`0123456789abcdefghjkmnpqrstvwxyz`), lowercased. Crockford
rather than base36 because it drops `i`, `l`, `o`, and `u`, which removes both visual confusion pairs — and ids
are retyped from a screen constantly, since unambiguous prefixes resolve everywhere an id is accepted. Six
characters rather than eight gives 32⁶ ≈ 1.07 × 10⁹, which is absurd overkill for a directory holding dozens of
files, and two fewer characters to type.

The **slug** is the title lowercased and stripped to word characters, spaces, and hyphens, with spaces becoming
hyphens, then truncated to 60 characters at the last hyphen that fits, falling back to `untitled` when a title
slugifies to nothing. It is a filename rule and nothing else depends on it.

## The frontmatter

```yaml
type: design # design | build. Required on a ticket; absent on a backlog item.
project: mvp # the map's filename stem. Required on a design ticket.
blockers: [k4m2p9] # ids this ticket waits on.
```

**An empty list is omitted, and an absent field means empty.** A field with one possible value is not a field
([Two ticket types (ADR 0007)](./0007-two-ticket-types-discriminated-by-how-they-close.md) makes the same
argument about status), and while every one of these files is hand-written, two lines of ceremony per ticket is
a real cost paid on every ticket to serve a minority of them.

There is no field naming the fog a ticket came from, because
[Nothing points at a fog patch (ADR 0033)](./0033-nothing-points-at-a-fog-patch.md) leaves nothing to name.

`project` is optional in the format and required by
[the integrity pass](../capabilities/07-integrity.md) for a design ticket. The parser does not enforce it,
because a malformed tracker must still be readable enough to tell you what is wrong with it.

## The body

A **design ticket's body is the question**. There is no required structure, because the question is the whole
artifact and a shape imposed on it would be answered rather than asked.

A **build ticket's body carries Background, Scope, and Done when**, the last written as an assertion someone
could check rather than an intention.

**Bearing does not validate either.** The error and warning sets in
[the integrity pass](../capabilities/07-integrity.md) are closed, and a check that a heading is present but
cannot check that it says anything useful trains people to write empty headings — worse than no check at all.
Rigour about done-when is taught by the skill bearing installs
([Bearing installs its own skill (ADR 0023)](./0023-bearing-installs-its-own-skill.md)), which is the artifact
that can explain what good looks like.

## Consequences

Bearing owns the frontmatter's structure because it computes over it, and reads the body as opaque prose. That
line is the same one drawn by
[Bearing reads maps and never writes them (ADR 0009)](./0009-bearing-reads-maps-and-never-writes-them.md): the
tool validates what it has a stake in and leaves the writing alone.
