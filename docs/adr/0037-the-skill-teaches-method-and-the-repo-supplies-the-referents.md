# The skill teaches method; the repo supplies the referents

`bearing-wayfinder` carries the portable method and nothing else — charting a map from a loose idea, then
alternating mapping passes and walks — written entirely in [`CONTEXT.md`](../../CONTEXT.md)'s vocabulary and
naming no other skill and no documentation taxonomy. Everything the method needs but cannot know, above all
what counts as a **durable artifact** in the repo it landed in, it resolves by reading what that repo already
keeps and by asking when it finds nothing.

The allocation, in the three directions the question had:

- **The shipped skill** teaches the method: what a destination and a patch of fog are, the three ways a patch
  leaves a pass, that blockers are wired in a second sweep, that done-when is an assertion someone could check
  rather than an intention, and that a fogbound map is what calls for the next pass. It names a bearing command
  only where a method step needs one, and leaves the command surface to `--help`.
- **The target repo** supplies the referents the skill points at and never writes: where a durable artifact
  lands, and the execution contract a build ticket becomes
  ([Bearing stops at the repo's edge (ADR 0014)](./0014-bearing-stops-at-the-repos-edge.md)).
- **This repository** keeps what is true of building bearing rather than of using it — the dogfooding rule, this
  project's own narrower answer to what counts as durable, the architectural rules, the definition of done.

And a fourth answer the question implied: bearing's **rationale belongs in none of them**. Why closing is
deletion, why the trail is append-only, why a patch has exactly three exits — a repo adopting bearing does not
have to re-litigate its design to use it. The skill teaches the method, not its justification, and cites nothing
in `docs/adr/` because those files do not ship.

## Consequences

**The skill cannot say "write an ADR."** It says to land the answer where the repo lands such things. In a repo
with no durable structure at all the first landing is preceded by a question to the human, and that landing
_creates_ the structure the next session discovers — so the ask is self-extinguishing rather than perpetual, and
bearing never acquires an opinion about how the repo documents itself.

**Asking does not violate the rule that bearing never prompts.** That rule constrains the binary, which is
invoked on every agent turn and must never block. The skill is read by an agent already in conversation with a
person, and a mapping pass is where that conversation happens.

**The command surface stays in `--help`.** [Bearing installs its own skill (ADR 0023)](./0023-bearing-installs-its-own-skill.md)
says the skill teaches the command surface; that is narrowed here to naming a command where a method step needs
one. The drift it guarded against is already prevented by shipping the skill and the binary in one package at
one version, and restating the surface would put it in two homes — one of which CI must grep
([The confirmation flag is undocumented on purpose (ADR 0016)](./0016-the-confirm-flag-is-undocumented-on-purpose.md)).

**This repository restates method and policy the skill also carries, deliberately.** The dogfooding rule sits in
both [`AGENTS.md`](../../AGENTS.md) and the live map's Notes, and that duplication stands: `AGENTS.md` is the
only doorway to the tracker, and a reader must not have to open an installed skill to learn that every
structured edit here is made by hand. Do not resolve it by deleting either copy.

## Considered options

**The `domain-modeling` pattern — skill carries method plus a seed, repo carries an instantiated spec at a known
path, skill defers to it.** Rejected. It would make wayfinder depend on a second skill's taxonomy, and on a
`docs/README.md` most adopting repos will never have; bootstrapping one is bearing having an opinion about how
the repo documents itself, which ADR 0014 rules out. The precedent is real and it stays where it is — it governs
this repository's docs, not what ships.

**Recording the discovered durability answer as policy in the map's Notes.** Rejected. It puts a second copy of
the repo's own convention inside the tracker, where it can drift from the documents it describes. A project may
still write a narrower answer there by hand, as this one does; the skill does not instruct it.
