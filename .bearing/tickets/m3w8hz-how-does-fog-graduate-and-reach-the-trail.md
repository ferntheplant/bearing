---
type: design
project: mvp
clears: [fog-graduation-and-map-maintenance]
---

# How does fog graduate and reach the trail?

**What is the exact lifecycle from a low-resolution fog patch, through whatever tickets it reveals, to the trail
row left by a closed design ticket?**

The phrasing matters: a fog patch does not itself enter the trail. Fog graduates into tickets; a closed design
ticket points from the trail to the durable artifact where its answer landed. What is unsettled is when the patch
leaves `Not yet specified`, what relationship a graduating ticket has to it, and whether remapping is a distinct
session or part of closing each design ticket.

The original
[wayfinder skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/wayfinder/SKILL.md)
provides a sharper baseline than this project's first map exercise:

- The map is an index, not a store, and does not list open tickets; the tracker derives those.
- Initial mapping is breadth-first. It creates every ticket whose question can already be stated precisely, then
  wires blockers in a second pass.
- `Not yet specified` excludes decided work and live tickets. It holds only the dim view that cannot yet be
  phrased sharply enough to ticket.
- Resolving a ticket may make more fog specifiable. Those newly visible tickets are created then, not guessed
  during the initial mapping session.

This project's use exposed several tensions:

- Multiple map patches were already precise questions with one-line answers. They were neither real fog nor
  worth a dedicated session of grilling, prototyping, or research.
- `Skill installation mechanics` and `What the skill teaches versus what the repo documents` exist both as live
  tickets and as nearly identical fog patches, even though the original method says live tickets leave
  `Not yet specified`.
- The session that settled tracker discovery, mutation dry runs, direct editing, and core module ordering acted
  like a remapping pass: cheap decisions landed immediately, one implementation slice became a build ticket,
  and the remaining cross-cutting question became visibly ticketable.
- A map-local backlog sounds useful as an agenda for the next mapping session, but may only create another work
  state. Sharp committed work is a ticket, sharp uncommitted work already has the tracker backlog, and genuinely
  unsharp work is fog.

The `clears` field is the mechanism most likely to reveal the right model. If a patch is removed when it becomes
a ticket, that ticket's link dangles immediately and `bearing check` warns on the normal case. If the patch stays
until the ticket closes, the map duplicates a live question. A third interpretation may be cleaner: a ticket can
probe a broader patch that remains genuine fog, while a ticket that directly graduates from a now-sharp patch
replaces it and needs no `clears` link. The ranking bonus and close-time reminder then belong only to probes that
are expected to expose more work.

The decision should settle:

1. What initial mapping, design-ticket closing, and an explicit remapping session each do.
2. Whether cheap decisions may land during mapping or every precise question becomes a ticket regardless of
   size.
3. Exactly when a patch leaves `Not yet specified`, including one patch becoming several tickets or none.
4. Whether `clears` means provenance, intent to probe broader fog, or something else, and what that means for
   ranking and drift warnings.
5. Whether `Not yet specified` is already the complete agenda for later mapping or another section earns its
   existence.
6. How the map stays a low-resolution artifact while the CLI derives the upcoming ticket view around it.

Settles as an ADR, with corresponding changes to the glossary's definition of graduation, the maps-and-fog
capability, and the wayfinder skill allocation ticket before that skill is written.
