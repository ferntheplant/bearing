# MVP

## Destination

Bearing tracks bearing. Every capability in [`docs/capabilities/`](../../docs/capabilities/) stands at **Built**
— every promise in that catalogue holds against the real binary — and this directory is maintained by the
`bearing` binary rather than by hand: the only editing left is prose someone has to think to write, which is a
ticket's question, this map's destination, notes, and fog, and the outcome text in a trail row.

The catalogue is the specification. There is no second list of criteria to check against, and writing one is the
mistake this map exists downstream of: a capability's bullets are the promise, a ticket's **Done when** is the
test, and its **Where it stands** is how far along it is.

## Notes

Everything that holds for working this tracker at all — what counts as a durable home, what to read before a
ticket, which skills to consult — is in [`../README.md`](../README.md) rather than here, because it is true of
every map this repository will ever hold. What follows is true of this map only.

**Dogfooding rule, and the reason this map exists.** Until the CLI exists, every structured edit in this
directory is made by hand: ids, filenames, frontmatter, blocker lists, trail rows. That is the experiment, not
an inconvenience to route around. When a hand-edit feels like clerical work, that is evidence about which
capability should absorb it — write the observation down where it belongs rather than absorbing it.

**Bearing's own format changes land here first.** This map is the only instance of the format bearing parses, so
a decision that changes the map format has to change this file, the parser, and its tests in one commit. A
change that leaves this file unparseable by the built binary is not finished.

## Trail

| id     | Decision                            | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| kwjvxc | Mutation atomicity                  | [Mutations are ordered, not atomic (ADR 0025)](../../docs/adr/0025-mutations-are-ordered-not-atomic.md)                                                                                                                                                                                                                                                                                                                                    |
| tdw9km | Tracker location                    | [`.bearing/` is fixed and discovered upward (ADR 0028)](../../docs/adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)                                                                                                                                                                                                                                                                                                                 |
| m3w8hz | Fog graduation and map maintenance  | [Mapping and walking alternate (ADR 0031)](../../docs/adr/0031-mapping-and-walking-alternate.md), [Structure in the map is written only at completion (ADR 0032)](../../docs/adr/0032-structure-in-the-map-is-written-only-at-completion.md), [Nothing points at a fog patch (ADR 0033)](../../docs/adr/0033-nothing-points-at-a-fog-patch.md), [A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) |
| 2z1qew | Skill installation mechanics        | [One owned skill installation, updated only while untouched (ADR 0036)](../../docs/adr/0036-one-owned-skill-installation-updated-only-while-untouched.md)                                                                                                                                                                                                                                                                                  |
| qrqrbn | Skill and repo allocation           | [The skill teaches method; the repo supplies the referents (ADR 0037)](../../docs/adr/0037-the-skill-teaches-method-and-the-repo-supplies-the-referents.md)                                                                                                                                                                                                                                                                                |
| h4p7vz | Distribution and release            | [Installation is a linked clone, and publishing is deferred (ADR 0038)](../../docs/adr/0038-installation-is-a-linked-clone-and-publishing-is-deferred.md)                                                                                                                                                                                                                                                                                  |
| d5wq2n | Tickets for work that was never fog | [A map holds intentions alongside fog (ADR 0039)](../../docs/adr/0039-a-map-holds-intentions-alongside-fog.md), [Core exposes operations, not tracker internals (ADR 0027)](../../docs/adr/0027-core-exposes-operations-not-tracker-internals.md)                                                                                                                                                                                          |

A row is a design ticket's closure and nothing else, so a decision settled without a ticket never appears here.

## Not yet committed

### Widen the starvation signal, or leave it about fog alone

A map with entries here and no open design tickets is in the same position a fogbound map is in: material left,
nobody deciding, and a frontier that reads as "nothing to do". Whether
[A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) should widen to cover
it, and whether the word survives if it does, is the one thing
[A map holds intentions alongside fog (ADR 0039)](../../docs/adr/0039-a-map-holds-intentions-alongside-fog.md)
deliberately left alone.

Sitting here rather than below because the intent is clear — the signal should not go quiet while a pass would
still be productive. What is unsettled is only the wording and the derivation, and a session that touches the
frontier can land it on the spot.

## Not yet specified

### Where a printed title comes from

An id is a handle and a title is what a human reads (§3.4), but bearing has no access to a title. The slug is
derived from the title and the body is opaque prose, so the only thing a listing can print is a de-slugged
filename — lowercased, punctuation stripped, hyphens turned back into spaces. `bearing` does exactly that today
and prints titles that are subtly not the ones anyone wrote.

Three ways out, none obviously right: accept the degradation and say so; let bearing read the body's first
heading, which contradicts the body being prose bearing does not parse; or stop claiming to print titles at all
and print slugs. Ticket and backlog listings render this — capture now writes the title as the body's first
heading, so the first-heading option is available for captured items without any new parsing — and it is worth
settling before their interfaces expand.

### What a query filter on `bearing ls` matches

The tickets capability promises `bearing ls` filters by "a query" and says nothing about what that matches.
Titles, or bodies too? Substring, or something looser? Matching bodies means the tracker gains a search surface,
which is a much bigger promise than a filter, and acquisition already holds every body losslessly so the cost is
a decision rather than an implementation.

Underneath it sits a question nobody has asked: whether `bearing ls` groups its output by project by default.
The **Filter tickets with `bearing ls`** build ticket delivered every other filter and deliberately left this
one out.

## Out of scope

- **Everything in [`ABSTRACT.md`](../../ABSTRACT.md) §5.** The non-goals are settled and are not re-litigated
  by a ticket on this map.
- **Other repositories adopting bearing.** The destination is bearing tracking bearing. Whether the method
  survives contact with a second repository is a real question and a later one.
- **Anything past the ticket→spec boundary.** Turning a build ticket into an execution contract is the repo's
  job, per
  [Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md),
  including in this repo.
