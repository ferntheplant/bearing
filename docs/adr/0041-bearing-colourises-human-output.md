# Bearing colourises human output

Bearing paints its rendered text with ANSI colour when it is writing to a terminal, and emits none at all
otherwise — when `NO_COLOR` is set, when stdout is a pipe or a file, and in `--json` output always. The frontier
capability promised `NO_COLOR` was respected while nothing anywhere emitted colour, which made it a promise about
nothing; this is the decision that gives it something to be about.

Colour is assigned by role, never by caller: a heading, an id, a status, a path, a command to copy. Ids take one
of six colours derived from the id itself, so a handle looks the same in `ls`, in `next`, and in every blocker
list that names it — which is the whole point, since an id is the thing a reader traces between listings. Red,
green, and yellow are excluded from that palette because they already mean error, ready, and blocked; an id that
happened to come out green would read as a status.

## Consequences

Every renderer takes a style rather than reaching for a colour, so the palette is one module and the plain style
is identity functions. That keeps the seam honest — tests assert against the plain style and see exactly what a
pipe sees — and it keeps
[Core returns values (ADR 0019)](./0019-core-returns-values-only-the-cli-renders.md) intact, because the domain
still returns values that know nothing about a terminal.
