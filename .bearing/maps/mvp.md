# MVP

## Destination

Bearing tracks bearing. The 29 criteria in [`ABSTRACT.md`](../../ABSTRACT.md) §8 pass, and this directory is
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

**This map charts design tickets only.** Specifiable work — deleting the empty `apps/` workspace, for instance —
is a backlog item until someone commits to it and a build ticket after that. It is not fog and it does not get a
patch here.

**Dogfooding rule, and the reason this map exists.** Until the CLI exists, every structured edit in this
directory is made by hand: ids, filenames, frontmatter, blocker lists, trail rows. That is the experiment, not
an inconvenience to route around. When a hand-edit feels like clerical work, that is evidence about which
criterion in §8 should remove it — write the observation down where it belongs rather than absorbing it.

## Trail

| id     | Decision                  | Outcome                                                                                                                        |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| kwjvxc | Mutation atomicity        | [Mutations are ordered, not atomic (ADR 0025)](../../docs/adr/0025-mutations-are-ordered-not-atomic.md)                        |
| tdw9km | Default tracker directory | [`.bearing/` is the default tracker directory (ADR 0026)](../../docs/adr/0026-dot-bearing-is-the-default-tracker-directory.md) |

A row is a design ticket's closure and nothing else, so a decision settled without a ticket never appears here.

## Not yet specified

### Skill installation mechanics

Detecting the agent-directory convention, writing without clobbering a local edit, and re-running to update.
Charted as research against an existing implementation; what stays fog until that reading happens is how much of
it bearing needs at all.

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

### What the skill teaches versus what the repo documents

Which sentences belong in the shipped wayfinder skill, which belong in a target repo's own docs, and which
belong in neither. The allocation is charted. What stays fog is the text itself — not a line of the skill has
been written, and `ABSTRACT.md` §6 lists a `skills/` directory that does not exist.

### Exit codes and the failure contract

Nothing anywhere records what any command returns. The integrity pass has a provisional answer — errors fail,
warnings do not, and a repo wanting stricter can grep — and that says nothing about the other commands:
what a refused design close returns against a failed one, whether a no-op direct mutation differs from one that
changes a file, or what an ambiguous id prefix exits with. An agent is the primary caller and will branch on
these, which makes them a shipped contract rather than an implementation detail. One slice of real CLI code now
makes the cases concrete enough to chart next.

## Out of scope

- **Everything in [`ABSTRACT.md`](../../ABSTRACT.md) §5.** The non-goals are settled and are not re-litigated
  by a ticket on this map.
- **Other repositories adopting bearing.** The destination is bearing tracking bearing. Whether the method
  survives contact with a second repository is a real question and a later one.
- **Anything past the ticket→spec boundary.** Turning a build ticket into an execution contract is the repo's
  job, per
  [Bearing stops at the repo's edge (ADR 0014)](../../docs/adr/0014-bearing-stops-at-the-repos-edge.md),
  including in this repo.
