# MVP

## Destination

Bearing tracks bearing. The 28 criteria in [`ABSTRACT.md`](../../ABSTRACT.md) §8 pass, and this directory is
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

A row is a design ticket's closure and nothing else, so a decision settled without a ticket never appears here.

## Not yet specified

### Publishing for the first time

The naming and distribution are decided; nobody has published a package before, so the mechanics are unknown
rather than undecided. Claiming the scope, a changelog discipline (Changesets, or a version bump and a tag for
a single-package repo), and publishing from CI with provenance via OIDC. The risk is not that a choice here is
wrong but that discovering the mechanics takes a day nobody budgeted.

### Update broadcasting

A version check at startup is ruled out by the 50ms budget, which leaves a check inside the integrity pass and
setup, or a cached passive notice refreshed out of band. Both need an answer to the same question first: does a
notice help at all when the primary caller is an agent that will not act on a banner and may be parsing the
output? The provisional answer — suppress any notice under `--json` and when stdout is not a TTY — mostly
empties the passive option, which is an argument for the simplest one. Not settled, and not urgent until
something is published.

### Measurements worth re-taking

Three numbers in `docs/gotchas.md` are one platform or one prototype wide. The compiled standalone binary lost
badly on macOS, where per-exec signature checking is a plausible part of the gap, and has never been measured
on Linux. The node bundle figure decides how cheap the escape hatch really is, if the Bun requirement ever
becomes an obstacle. And the 50ms budget has never been measured against parsing an actual tracker — nothing
threatens it, and nothing has tested it either. Which of these is worth a ticket depends on what the first
slice reveals.

### Migrating the ancestor's tracker

Bebop's local tracker is the source this descends from, and moving it across is a one-time manual job. The part
that is fog is not how to do it but when: **as long as migration is manual, the on-disk format can keep
moving**, and the moment there is a migration tool the format has a compatibility obligation it has not earned.
So this patch is really a question about ordering — how late this can be left, and what signal says the format
has stopped moving.

### Exit codes and the failure contract

Nothing anywhere records what any command returns. The integrity pass has a provisional answer — errors fail,
warnings do not, and a repo wanting stricter can grep — and that says nothing about the other commands:
what a refused design close returns against a failed one, whether a no-op direct mutation differs from one that
changes a file, or what an ambiguous id prefix exits with. An agent is the primary caller and will branch on
these, which makes them a shipped contract rather than an implementation detail. One slice of real CLI code now
makes the cases concrete enough to chart next.

### What the status dashboard shows

Bare `bearing` is a dashboard in [`ABSTRACT.md`](../../ABSTRACT.md) §6 and nothing anywhere says what is on it.
Fogbound is what made that matter — it is the first thing that belongs on a dashboard and not in a work queue,
which means the dashboard now has at least one job nothing else does. Survives this pass because `bearing next`
has never printed anything: specifying a second view before the first one exists would be guessing at the shape
of output nobody has seen.

### Whether a trail row's pointer is checked

Consolidating the superseded ADRs broke a trail row and nothing noticed — `tdw9km` pointed at ADR 0026, which
had been folded into 0028, and the row was repointed by hand only because someone happened to be reading it. A
dangling blocker and a dangling project are both errors; a trail row pointing at a file that no longer exists is
nothing at all. The tension is real in both directions: durable artifacts get renamed and merged, which is an
argument for checking, and the outcome cell is deliberately free prose that bearing does not parse
([Three frontmatter fields, and the body is prose (ADR 0024)](../../docs/adr/0024-three-frontmatter-fields-and-the-body-is-prose.md)
draws the same line for a ticket body), which is an argument against. Survives this pass because it is the first
instance, one instance is not a pattern, and the fix would extend a deliberately closed error set.

### A design ticket that turns out to be premature

[The trail is append-only and a row is a pointer (ADR 0010)](../../docs/adr/0010-the-trail-is-append-only-and-a-row-is-a-pointer.md)
says a question that ended badly still gets a row. What it does not say is what happens to the question when the
answer is "not until something is built" — whether the ticket closes with a row and the question returns to this
section as fresh fog, or stays open as a blocked ticket until the build work lands. Survives this pass because
both readings are defensible on paper and this repo has not hit a real instance yet.

## Out of scope

- **Everything in [`ABSTRACT.md`](../../ABSTRACT.md) §5.** The non-goals are settled and are not re-litigated
  by a ticket on this map.
- **Other repositories adopting bearing.** The destination is bearing tracking bearing. Whether the method
  survives contact with a second repository is a real question and a later one.
- **Anything past the ticket→spec boundary.** Turning a build ticket into an execution contract is the repo's
  job, per
  [Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md),
  including in this repo.
