# MVP

## Destination

Bearing tracks bearing. The 27 criteria in [`ABSTRACT.md`](../../ABSTRACT.md) §8 pass, and this directory is
maintained by the `bearing` binary rather than by hand — the only editing left is prose someone has to think to
write: a ticket's question, this map's destination, notes, and fog, and the outcome text in a trail row.

## Notes

**What counts as durable here.** A design ticket may close when its answer lands as an ADR under `docs/adr/`,
an edit to a capability file, a term in `CONTEXT.md`, an entry in `docs/gotchas.md`, or a change to
`ABSTRACT.md`. Nothing else counts — not a commit message, not a PR comment, not a paragraph in this map. A
trail row points at one of those five, or the ticket is not finished.

**Read before working a ticket here.** `ABSTRACT.md` for what the whole thing is, the capability file for the
area being touched, and the ADRs that capability links. `CONTEXT.md` is binding vocabulary: a ticket is not an
issue, a project is a map, closing is deleting, the trail is not a route.

**Skills every session should consult.** `domain-modeling` whenever the model or the durable docs change —
which is most design tickets, since closing one means writing one of the five. `codebase-design` whenever a
seam is being placed.

**Standing preferences.** Effect dependencies pinned exactly, never ranged. Core returns values; only the CLI
renders. `vp check` and `vp test` before anything is called done. Conventional Commits.

**This map charts fog only.** Specifiable work — deleting the empty `apps/` workspace, for instance — is a
backlog item until someone commits to it and a build ticket after that. It is not fog and it does not get a
patch here. A mapping pass may well produce build tickets out of a patch; what it never does is write
specifiable work down as fog.

**Dogfooding rule, and the reason this map exists.** Until the CLI exists, every structured edit in this
directory is made by hand: ids, filenames, frontmatter, blocker lists, trail rows. That is the experiment, not
an inconvenience to route around. When a hand-edit feels like clerical work, that is evidence about which
criterion in §8 should remove it — write the observation down where it belongs rather than absorbing it.

## Trail

| id     | Decision                           | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| kwjvxc | Mutation atomicity                 | [Mutations are ordered, not atomic (ADR 0025)](../../docs/adr/0025-mutations-are-ordered-not-atomic.md)                                                                                                                                                                                                                                                                                                                                    |
| tdw9km | Tracker location                   | [`.bearing/` is fixed and discovered upward (ADR 0028)](../../docs/adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)                                                                                                                                                                                                                                                                                                                 |
| m3w8hz | Fog graduation and map maintenance | [Mapping and walking alternate (ADR 0031)](../../docs/adr/0031-mapping-and-walking-alternate.md), [Structure in the map is written only at completion (ADR 0032)](../../docs/adr/0032-structure-in-the-map-is-written-only-at-completion.md), [Nothing points at a fog patch (ADR 0033)](../../docs/adr/0033-nothing-points-at-a-fog-patch.md), [A fogbound map is reported (ADR 0034)](../../docs/adr/0034-a-fogbound-map-is-reported.md) |
| 2z1qew | Skill installation mechanics       | [One owned skill installation, updated only while untouched (ADR 0036)](../../docs/adr/0036-one-owned-skill-installation-updated-only-while-untouched.md)                                                                                                                                                                                                                                                                                  |
| qrqrbn | Skill and repo allocation          | [The skill teaches method; the repo supplies the referents (ADR 0037)](../../docs/adr/0037-the-skill-teaches-method-and-the-repo-supplies-the-referents.md)                                                                                                                                                                                                                                                                                |
| h4p7vz | Distribution and release           | [Installation is a linked clone, and publishing is deferred (ADR 0038)](../../docs/adr/0038-installation-is-a-linked-clone-and-publishing-is-deferred.md)                                                                                                                                                                                                                                                                                  |

A row is a design ticket's closure and nothing else, so a decision settled without a ticket never appears here.

## Not yet specified

## Out of scope

- **Everything in [`ABSTRACT.md`](../../ABSTRACT.md) §5.** The non-goals are settled and are not re-litigated
  by a ticket on this map.
- **Other repositories adopting bearing.** The destination is bearing tracking bearing. Whether the method
  survives contact with a second repository is a real question and a later one.
- **Anything past the ticket→spec boundary.** Turning a build ticket into an execution contract is the repo's
  job, per
  [Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md),
  including in this repo.
