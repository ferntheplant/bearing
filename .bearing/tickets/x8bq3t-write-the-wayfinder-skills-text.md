---
type: build
project: mvp
blockers: [66r5rr, 73jcw6]
---

# Write the wayfinder skill's text

## Background

`skills/bearing-wayfinder/SKILL.md` is a stub that says it is a stub. It exists so the managed installation path
could be exercised before the method's instructions were settled, and that path now works — but a repo running
`bearing init` today receives a file that teaches nothing.

Both inputs are settled.
[Mapping and walking alternate (ADR 0031)](../../docs/adr/0031-mapping-and-walking-alternate.md) and
[A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) fix what the method
says; [The skill teaches method; the repo supplies the referents (ADR 0037)](../../docs/adr/0037-the-skill-teaches-method-and-the-repo-supplies-the-referents.md)
fixes which sentences are the skill's to carry. What remains is writing it.

The hole that used to sit here — what the alternating loop does once a map is fog-complete and its destination
is not yet reached — is filled by
[A map holds intentions alongside fog (ADR 0039)](../../docs/adr/0039-a-map-holds-intentions-alongside-fog.md).
A pass drains two sections, so specifiable work has a home on the map and a producer, and the method the skill
teaches no longer runs out of moves while the destination is unreached.

## Scope

Replace the stub with the real method: charting a map from a loose idea, and alternating mapping passes and
walks until the destination is reached. Consult the `writing-for-agents` skill — this is a skill being written,
and it ships to strangers.

The skill's whole vocabulary is [`CONTEXT.md`](../../CONTEXT.md)'s. It carries no rationale for bearing's own
design, cites nothing under `docs/`, and names no other skill.

Out of scope: the installation mechanics, which are built; the target repo's spec format, which is the repo's
per [Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md); and
anything about building bearing itself.

## Done when

- `skills/bearing-wayfinder/SKILL.md` carries `name` and `description` frontmatter, and no sentence describing
  itself as temporary or unfinished.
- It teaches charting a map as sorting a loose idea across two sections — what you already intend, and the fog
  you cannot yet state — after naming a destination, with the test being certainty about what rather than size.
- It teaches the alternating passes and walks, including an entry's three exits, that a pass drains both
  sections, blocker wiring as a second sweep, and done-when as an assertion someone could check.
- It says the map's notes carry only what is true of that project, and that anything true of every map belongs
  in the repository's own instructions.
- It says a fogbound map is the signal that calls for the next mapping pass.
- It resolves where a durable answer lands by reading what the target repo already keeps, and by asking when it
  finds nothing. Whether it may also instruct writing that answer down, and where, is `73jcw6`'s to settle —
  this ticket follows whatever that lands, and instructs no configuration file either way.
- The text contains no occurrence of `ADR`, `capability file`, `gotcha`, `docs/README.md`, `domain-modeling`, or
  `codebase-design`.
- Every bearing command it names is one a method step it just described requires. It does not enumerate the
  command surface.
- CI's grep over the shipped skill for the flag that applies a design close passes.
- Its last instruction on any ticket-producing path is a handoff: the skill stops at a ticket someone could pick
  up and says so.
- `bearing init` in an empty directory installs the file, and re-running it against the untouched installation
  reports an update rather than a skip.
