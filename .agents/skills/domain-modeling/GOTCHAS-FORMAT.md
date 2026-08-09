# Gotchas Format

One file: `docs/gotchas.md`. Created lazily, when the first entry earns its place.

## What a gotcha is

**Behaviour that looks like a defect in our code and is not.** Two kinds qualify:

1. **We did not choose it.** The runtime, the driver, the registry, or the toolchain chose it for us. That is
   what separates a gotcha from an [ADR](./ADR-FORMAT.md) — there was no alternative to weigh, only a fact to
   discover and work around.
2. **We chose it deliberately as the weaker mechanism**, and it stands until a decision that has not been taken
   yet. The entry says what would replace it.

If we picked one option over a genuine alternative for reasons a reader would wonder about, that is an ADR, not
a gotcha. If it is merely a term, it is `CONTEXT.md`.

## The rule that makes the file work

**Every entry names the obvious-looking simplification that reintroduces the problem.** That is the whole point
of the file: each of these has already been shipped once, and each of them looks like tidiness to someone who
did not hit it. An entry that does not name the tidying it prevents is a note to nobody.

Where it matters, also name **how it fails** — as a flake, a silently widened type, a timeout in an unrelated
request — because that is what a future reader will actually be holding when they come looking.

## Structure

```md
# Gotchas

{One paragraph: what this file holds and why none of it is an ADR.}

## {Area — build and packaging, persistence, process lifecycle, static analysis, …}

**{The finding, as a complete sentence in bold.}** The prose: what actually happens, what it cost to find, the
constraint that now stands because of it, and the tidying that brings it back.

**{Next finding.}** …
```

Group under `##` headings by the area of the system a reader would be working in when they hit it — not by
severity and not chronologically. A heading is worth adding at three entries.

## Rules

- **The bold lead is the whole finding.** Someone skimming bold text should learn the fact without reading the
  paragraph. Write it as a statement, not a topic.
- **Keep the measurement.** Where a number is the reason — a timing, a size, a version — write the number and
  when it was taken. A gotcha justified by "it was slow" rots into folklore.
- **Cite the ADR the gotcha constrains**, where one exists, rather than re-arguing it.
- **Delete entries that stop being true.** A gotcha whose upstream bug was fixed is worse than no entry, because
  it keeps a workaround alive. Removing one is a normal change.
- **Before a line of code exists**, entries are registry and measurement findings rather than production scars.
  Say so in the file's opening paragraph so nobody reads them as battle damage.
