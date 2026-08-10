---
type: design
project: mvp
---

# What the skill teaches versus what the repo documents

**Which sentences belong in the wayfinder skill, which belong in the docs bearing's own repo keeps, and which
belong in neither?**

`ABSTRACT.md` §6 lists a `skills/` directory that does not exist. ADR 0023 is unusually specific about what the
method _contains_ — that resolving one design ticket yields a short ordered run of build tickets, vertical
slicing and one-pass blocker wiring from one ancestor, done-when rigour from the other, and why those do not
compose as cleanly as they look — and says nothing about how much of that is the skill's text versus context a
reader is assumed to have. Criteria 1 and 2 cannot pass until the text exists.

The question is an allocation, and there are three destinations:

- **The shipped skill**, installed into a target repo. Teaches method: how to chart a map from a loose idea, and
  how to alternate mapping passes and walks. It ships to strangers, so it can assume nothing about the repo it
  lands in.
- **The target repo's own docs**, which the skill can point at but not write.
- **This repo's `AGENTS.md` and `docs/`**, which are about building bearing rather than about using it, and
  which currently carry method that would be wrong to ship — the dogfooding rule, for instance, is true here and
  meaningless anywhere else.

There is a decided precedent to apply rather than re-derive: this repo settled that a skill carries the portable
method and a seed, and the repo carries the instantiated spec, with the skill deferring to the repo wherever the
repo has spoken — see [`docs/README.md`](../../docs/README.md) and the `domain-modeling` skill it governs.
Whether the wayfinder skill should work the same way is the first thing to test, and the answer may differ,
because wayfinder ships to repos that will never have a `docs/README.md` at all.

Two constraints the text inherits: it stops at a ticket someone could pick up and hands off rather than
half-writing a spec
([Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md)), and it
must never mention the flag that applies a design close
([The confirmation flag is undocumented on purpose (ADR 0016)](../../docs/adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)),
which CI greps for. It teaches direct tracker-file editing and direct mutations rather than the removed `edit`
command or a universal dry-run ritual.

**The method itself is no longer part of this question.**
[Mapping and walking alternate (ADR 0031)](../../docs/adr/0031-mapping-and-walking-alternate.md) settled the two
phases and the three ways a patch leaves a pass, and
[A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) settled the signal
that calls for the next one. What remains here is purely where each sentence lives, not what it says.

Settles as an ADR on the allocation. The skill text itself is the build tickets that follow.
