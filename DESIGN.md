# Bearing — design draft

**Status: draft.** This records what six rounds of design conversation settled, and marks what it did not.
Nothing here has been built.

Bearing is a file-based issue tracker and CLI for exploring a **fog of war**: work too large for one agent
session, where the route to the destination is not yet visible. It descends from bebop's local Markdown tracker
and its `wayfinder` skill, which in turn descend from Matt Pocock's `wayfinder`. It takes its command
ergonomics — not its task philosophy — from [dex](https://dex.rip).

The name is the method: you take a bearing, walk it, and take another when the view changes.

## The inversion

In bebop the tracker is scaffolding deliberately excluded from the product. In bearing the tracker **is** the
product, so everything bebop hardcodes has to be split into layers:

| Layer         | Example                                                         | Where it lives            |
| ------------- | --------------------------------------------------------------- | ------------------------- |
| **Mechanism** | close = delete; a blocker is satisfied when it no longer exists | ships with bearing        |
| **Policy**    | what counts as durable _here_ — `docs/adr/`? capability docs?   | the map's Notes, as prose |
| **Method**    | wayfinder; when to chart a map at all                           | a skill bearing installs  |

Policy is the layer that shrank most since the first draft. It was going to be config bearing reads; it is
prose bearing never parses. Bearing's config holds exactly one thing — where the tracker lives.

The type vocabulary is mechanism, but the _method_ names bebop encoded as types (`grilling`, `prototype`,
`research`) are not — they are names of bebop's own skills. Bearing ships two types and lets users write method
into the ticket body.

## Principles

1. **The tracker is an in-the-moment tool, not an audit.** It answers one question: what has been committed to
   and not yet finalized into the repo? A ticket leaves the moment its reasoning lands somewhere durable —
   deleted, not archived. Git remembers.
2. **The frontier is rendered, never stored.** No file says "the next work is." Everything derivable is derived.
3. **Nothing outside the tracker links into it.** Source, ADRs, and docs cite durable artifacts, never tickets.
   The tracker's own doc and skill are the exception, since they have to know where it is.
4. **Prose refers by title; ids are handles.** An id is for typing at a shell or a file picker. A title is what
   a human reads.
5. **Bearing reads prose and checks it. It never writes prose.** Maps are hand-edited. The tool validates.
6. **A map is a decisioning instrument.** It tracks the fog between here and the destination and points at the
   decisions that clear it. It charts design tickets only.
7. **Bearing stops at the repo's edge.** It tracks ideas and commitments _before_ they are canonicalized into
   the repo. It knows nothing about how the repo builds, tests, or validates itself.
8. **Every command is operable by an agent.** No prompts, no TTY assumptions, no question a non-human caller
   cannot answer. Where a second look matters, it is a dry run and a `--confirm` re-run. `bearing init` is the
   single exception, and it runs once.

## Data model

```
.scratch/
  backlog/<id>-<slug>.md          # untriaged — no frontmatter; being here is the status
  tickets/<id>-<slug>.md          # every ticket, design and build
  maps/<project>.md               # Destination / Notes / Trail / Not yet specified / Out of scope
```

Three flat directories. **A project has no directory — a project _is_ a map file**, and membership is a
frontmatter field naming its stem.

An earlier draft nested tickets under `<project>/tickets/`, making membership a path. Two things were wrong
with it. Promotion was a move across directory levels, so the cheapest triage verdict was the most
disruptive edit. And the map ended up sitting in a directory whose only other content was the tickets the map
deliberately does not list — a directory that implied a table of contents the design had already rejected.

Flat, the map is the whole of the project: destination, fog, trail. Membership is a one-word edit, and a file
move survives in exactly one place — `backlog/` to `tickets/`. The cost is that "design tickets live only in a
project" becomes a check rather than a property of the filesystem, which is a cheap check.

### Identity

Every item is named `<id>-<slug>.md`, where `id` is an 8-character nanoid over `[0-9a-z]` and `slug` is derived
from the title. **The filename is canonical** — the id appears nowhere else, so it cannot desync.

The id is identity for life. A backlog item promoted into a project keeps it across the move; a retitle
changes only the slug half. Because retitles change the filename, **bearing owns rename** — doing it by hand is
how you get an id whose slug lies.

The CLI accepts unambiguous id prefixes, so 3–4 characters is usually enough to type.

### Tickets

```yaml
---
type: design # design | build
project: local-end-to-end-bounty # map stem; required on design, optional on build
blocked-by: [k2m9x4qp] # ids only; omit when empty
clears: [what-ein-is-actually-told] # design only, advisory; omit when empty
---
```

Four fields, one of them advisory. There is **no status field**: a ticket goes from existing to deleted in a
single PR, so `open` was the only value it could hold, and a field with one value is not a field.

`project` names a map file stem — `project: fallow-cleanup` means `maps/fallow-cleanup.md`. Unlike `clears`, it
is referential: a dangling `project` is an error. It is the one place an id-like handle appears inside a file
rather than in a filename, and it is safe there because a map's stem is human-chosen and stable, unlike a slug
derived from a title.

The two types are defined by how they close:

> **A design ticket closes as an artifact. A build ticket closes as a commit.**

That test is the whole discriminator. Manual work that unblocks a decision — provisioning access, signing up
for a service so its API can be judged — is `design`, because its outcome is knowledge.

Finer-grained method (is this settled by conversation? by a rough prototype? by reading third-party docs?) is
written into the ticket body by whoever writes it. Bearing does not model it.

**Design tickets always name a project.** A build ticket may or may not — an unprojected build ticket is one no
live map owns, which is the normal case for work that was specifiable from the start. So the set of tickets
with no `project` is always directly actionable.

### Ticket bodies

A **design** ticket's body is the question, sized to one agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

A **build** ticket carries three:

```markdown
## Background <!-- why, citing the durable artifacts that decided it -->

## Scope <!-- what changes -->

## Done when <!-- what must be true, in prose -->
```

### Where bearing stops

An earlier draft gave build tickets a fourth section, `## Verification`, naming the testing seam the assertions
would be made from, and templated the repo's gate command into `Done when` from config. Both are cut, and the
reason is worth recording because the two concepts stay adjacent and will keep trying to merge.

**A bearing build ticket is a commitment. A bebop bounty spec is an execution contract.** The ticket says this
will be built, here is why, here is what must be true when it is. The spec says how an agent proves it: the
testing seam, the gate command, acceptance criteria, the constraint profile. Those are properties of the repo,
and the moment bearing templates one it has an opinion about how the repo validates itself — which is the
intrusion principle 7 exists to prevent.

The two are related the way a decision is related to its implementation, and the boundary is the same one
close-is-delete draws everywhere else: bearing holds what has been committed to and not yet canonicalized.
Writing the spec _is_ the canonicalization, and it happens in the repo, in the repo's own format, with the
repo's own skill. Where a repo has no such format, `Done when` in prose is the whole of it, and that is a fine
place to be — the ticket is still legible to an agent, it just is not a contract.

One consequence to accept honestly: bearing build tickets are not directly executable. The step from ticket to
spec is real work that bearing does not do. That is the trade, and it is what keeps bearing usable in a repo
that has never heard of bounties.

### Backlog items

No frontmatter at all — being in `backlog/` is the status. Items still get ids, because the filename carries
them and a handle is needed for triage.

**Length is not the test.** An earlier draft said a backlog item is a title and a couple of sentences, and that
anything longer is already sharp enough to be a ticket. That is wrong, and the counterexample is the most
common way real items arrive: you are working a ticket, testing turns up an adjacent bug, and you know the
reproduction exactly. Reproduction steps, the failing output, the file you suspect — all of it should go in
while you have it, because you will not have it later. What is missing is not information. It is a decision
about whether this is worth doing, at what size, in whose lane.

So the test is **scoping, not volume**: an item is a backlog item until someone has committed to it. A long,
precise bug report with no owner and no size is exactly a backlog item. Writing it down cheaply and completely
is the point of the folder; deciding what it costs is triage's job, later, deliberately.

The backlog holds two things: untriaged findings, and **unmoored fog** — something you cannot specify and
cannot yet attach to any destination. It waits there until a destination can be named. "Leave it in the
backlog" is a real triage verdict, not a failure to triage.

### The map

A project _is_ a map. Maps exist only where work is genuinely ill-defined; well-defined work is unprojected
build tickets.

```markdown
# <Project name>

## Destination

<what reaching the end looks like — one or two lines>

## Notes

<domain; skills every session should consult; standing preferences>

## Trail

<the table below>

## Not yet specified

<### headings, one per fog patch, prose beneath>

## Out of scope

<boundaries declared up front — never graduates>
```

Open tickets are **not listed** on the map; they are found by scanning `tickets/` for a matching `project`. Two
places to keep in step means one of them rots.

### The Trail table

Called **Route** in the first draft, which read as API routing on every encounter. A trail is what you leave
behind you, which is exactly what this is — the route is the thing ahead, and the route is precisely what a fog
of war means you do not have.

Append-only, one row per design ticket closed, written by hand in the same commit that deletes the ticket and
lands the artifact. Chronological by construction, which is what makes it read as a trail rather than a
changelog.

| id         | Decision                           | Outcome                           |
| ---------- | ---------------------------------- | --------------------------------- |
| `k2m9x4qp` | Which model does each seat run?    | settled → [ADR 0052](…)           |
| `c3ffne86` | How does the proxy authenticate?   | invalidated by `k2m9x4qp`         |
| `p7n4j9q2` | Should jet run a different vendor? | out of scope — needs provisioning |
| `w8dk2brt` | Where does the lease live?         | bad question — see `k2m9x4qp`     |

**Every design ticket gets a row.** A malformed question gets a row saying so; there is no deletion path that
skips the table.

One constraint keeps this from becoming the thing close-is-delete was meant to kill: **a row is a pointer,
never a summary.** The moment rows carry rationale, the map has rotted again with table syntax.

The row is the only record of a deleted ticket that survives inside the tracker, which is what makes the trail
worth keeping after the fog is gone — see [Map lifetime](#map-lifetime).

This gives **Out of scope** a cleaner job than bebop's. It holds boundaries _declared_; the table holds
boundaries _discovered_. Neither explains itself twice.

### Fog

Patches are `###` headings under `## Not yet specified`, prose beneath, deliberately coarser than a ticket. The
test is unchanged: **ticket** when you can state the question precisely now, even if blocked; **fog** when you
cannot phrase it that sharply.

Bearing parses heading text and nothing else. The heading also gives each patch a real anchor
(`maps/local-end-to-end-bounty.md#what-ein-is-actually-told`) that resolves in GitHub and editor previews, so
tickets can link fog in prose.

A design ticket points at fog with `clears:`, written at creation with no second wiring pass. **Fog links are
advisory, not referential** — a dangling `clears` warns but never fails, because fog rephrasing and fog
clearing are both normal. This is the deliberate looseness: no fog ids, no lifecycle, no partial-graduation
tracking.

Two things it buys, which are the whole point:

- **Ranking that isn't wrong.** Transitive gate count only sees _charted_ dependents, so a design ticket whose
  purpose is to burn off three patches of fog scores zero. Counting `clears` puts fog into the ranking.
- **A reminder at the right moment.** Closing a ticket that claimed to clear a patch puts the patch on screen.
  Graduation is the step that gets skipped, and this is the only moment anyone is looking at both the answer
  and the patch.

#### Anchor drift

Maps are hand-edited, so headings get reworded and every `clears` pointing at the old text goes dangling. Left
alone this rots quietly: warnings accumulate, everyone learns to ignore them, and the ranking silently stops
counting fog.

So bearing detects drift and names the repointing command. `bearing check` already sees a dangling `clears` and
the current heading set; when a heading looks renamed rather than removed, the fix is mechanical, and the
warning carries the exact command that applies it:

```
$ bearing check
warn  m4k2p8qr  clears: `what-ein-is-told` — no such patch
      closest heading: `what-ein-is-actually-told`
      bearing fog --repoint m4k2p8qr what-ein-is-actually-told
```

Two things keep this honest. Bearing edits the ticket's frontmatter, never the map — principle 5 holds, the
hand-written file stays hand-written. And repointing is never automatic, because "heading reworded" and
"heading removed because the fog cleared" produce the identical dangling pointer, and only the operator knows
which happened. The fuzzy match is a suggestion in output, never an edit; the target heading is named
explicitly on the command line, so applying it is a decision someone made rather than one bearing guessed. A
warning left in place is now meaningful again.

## Lifecycle

### Triage

Give each backlog item the cheapest home that fits:

1. **Delete it** — not real, already fixed, duplicate.
2. **A build ticket, unprojected** — specifiable now, no map owns it.
3. **A ticket with `project:`** — belongs to a live map, design or build.
4. **A new map** — a nameable destination plus at least one thing you cannot yet specify.
5. **Leave it** — unmoored fog, waiting for a destination.

Every verdict but the first is the same move from `backlog/` to `tickets/` plus frontmatter; they differ
only in what the frontmatter says. Verdict 4 additionally writes `maps/<project>.md`.

**Stub maps are allowed**, which is verdict 4's low bar. Bebop used them as holding pens for real destinations
that were not next, and the practice survives: a map with a destination and one fog patch is a legitimate map.
The threshold used to read "at least two things you cannot yet specify," on the theory that one patch of fog is
not a project. But a destination is not a bookkeeping convenience — naming one is the actual work, and a map
that has done it has earned its file whether it holds one patch or five. One fog patch and no destination is
still verdict 5; that is the line, and it is the destination that draws it.

### Blocking

`blocked-by` names ids, which may live in any project — the decision frontier runs ahead of the build frontier,
so cross-project blocking is normal. **A ticket is unblocked when every id it names no longer exists**; an
absorbed blocker is a satisfied one. A dangling blocker is an error, unlike a dangling `clears`.

### Closing

Closing is deletion, in the same change that lands the work. What bearing checks is **asymmetric by type**,
because the two types have structurally different evidence:

**Build.** The durable artifact is the diff it shipped with, so there is nothing to cite — the deleting commit
_is_ the evidence, and it is recoverable. Bearing deletes the file and strips the id from every `blocked-by`,
and checks nothing else.

It specifically does not inspect the working tree or the commit. An earlier draft wondered whether deleting a
build ticket in a commit with no other changes deserves an advisory warning. It does not, because the intended
shape of the work makes it a false positive by construction: a ticket's work is a series of commits on a
branch, and the last of them closes the ticket. That last commit routinely touches nothing else, and the
evidence is the merge, which does not exist yet when `close` runs. A warning that fires on the normal case is
noise.

**Design.** The artifact is a different file, and that link is not derivable. Closing a design ticket is the one
moment anyone is looking at the answer, the trail, and the fog at the same time, so bearing puts all three on
screen — but as **a dry run that must be re-run to take effect**, not as a prompt:

```
$ bearing close k2m9
  Which model does each seat run?  (design · local-end-to-end-bounty)

  Trail row   | k2m9x4qp | Which model does each seat run? | settled → [ADR 0052](…) |
  Fog         ### What ein is actually told   — still present

  Would delete  k2m9x4qp-which-model-does-each-seat-run.md
  Would strip   k2m9x4qp from blocked-by of c3ffne86, p7n4j9q2

  If the trail row is right and the fog is clear, re-run with --confirm.
  (Bearing does not edit maps — clearing the patch is yours.)

$ bearing close k2m9 --confirm
  deleted  k2m9x4qp-which-model-does-each-seat-run.md
  stripped from blocked-by:  c3ffne86, p7n4j9q2
```

The hard gate is unchanged and stays a refusal: the map's Trail table must have a row for this id, and that
row's Outcome must be non-empty. What the dry run adds is that having found the row, bearing shows it verbatim.
A row written three commits ago and since invalidated passes a mere existence check and fails anyone who reads
it; printing it at closing time is what catches that.

Bearing never edits a map, so it cannot clear the fog patch itself — it prints the patch and says so. That
keeps the tool out of the one file with real conflict potential.

**Dry-run-by-default is the shape of the whole CLI**, not a flourish here. The design goal is that bearing is
fully operable by an agent, and an interactive prompt is the one thing an agent cannot answer — it blocks, or
worse it gets a default guessed on its behalf. A confirmation prompt and a re-run with `--confirm` carry the
same information and force the same second look, but the second is a transcript: two commands, both replayable,
both legible in scrollback afterward. The only interactive command in bearing is `bearing init`, which runs
once, at a keyboard, before any of this exists.

Deleting the ticket inside the PR that lands the work is deliberate: a reviewer seeing
`- .scratch/tickets/k2m9x4qp-which-model-does-each-seat-run.md` in the diff is seeing the PR's claim about what
it finished.

### Map lifetime

A map has two endings, and the earlier draft collapsed them into one. Keeping them apart is what decides how
long the `project` field lives.

**Fog-complete** is when **Not yet specified** is empty and no design ticket names the map. The map has stopped
being a decisioning instrument: there is nothing left to chart, and it will never appear in DECIDE again.

But it is not finished, because the trail is still load-bearing. The build tickets that fell out of those
decisions are still open, and every one of them was written by someone standing on a chain of resolved
questions. A builder picking one up wants the map's Destination for what this is all for, its Notes for the
standing preferences, and above all its Trail for what was already settled and why the ticket says what it
says. Deleting the map at fog-completion would delete exactly the context the remaining work needs, at exactly
the moment the people doing that work are furthest from the conversation that produced it.

So: **a map lives until its last ticket closes.** Not until the fog clears — until nothing names it.

That is what earns `project` its place on build tickets, which the last round had down as an open question.
The field is not decoration for `ls --project`; it is the tracker's answer to "is this map still needed," and
it is the pointer a builder follows from a ticket to the reasoning behind it. So `project` stays on every
ticket that belongs to a map, design and build alike, for the ticket's whole life. Unprojected build tickets
are still normal — they are the ones no map ever owned.

**Closing the map** is then the same operation as closing anything else, with no special case at all:

```
bearing close --map <project>      # dry run: refuses if any ticket still names it
bearing close --map <project> --confirm
```

It deletes the file. There is no durable home, no `docs/maps/`, no archive — and this is the second thing the
earlier draft got wrong. It had the map written out to a permanent location on the way out, which is precisely
the archiving instinct close-is-delete exists to refuse. By the time a map can close, every Trail row already
points at a durable artifact that outlives it. The map's own copy is a duplicate of pointers, and git holds it
if anyone ever wants the shape of the walk. Nothing is lost by deleting it, and keeping it would give the repo
a second place where decisions appear to live.

This also removes the flat layout's one real cost. The last draft needed `close --map` to strip `project:`
across N tickets, because the field was supposed to die at fog-completion. Now the field outlives the fog and
the map outlives it too, so closing a map touches exactly one file: the map.

## The frontier

Derived on every run, never stored. Three sections:

- **BUILD** — open, unblocked build tickets, flat, ranked by transitive gate count. Flat, but each row tagged
  with its project where it has one, because that tag is the pointer to the trail the ticket rests on.
- **DECIDE** — open, unblocked design tickets, grouped by project, each group headed by its destination line
  and fog count. Ranked by gate count **plus fog cleared**. A fog-complete map has no design tickets, so it
  drops out of DECIDE while its build tickets are still running — the map goes quiet before it goes away.
- **TRIAGE** — the backlog count. Load-bearing rather than hygiene, since this is where projects come from.
  An earlier draft also showed the oldest item's age, which meant asking git when each file was added: a
  subprocess on the most frequently run command in the tool, to render a number whose only message is "there is
  a backlog." The count already says that.

Build outranks decide overall: something already specified and unbuilt is the answer to "what next."

## CLI surface (draft)

Verb shape and ergonomics from dex; aliases everywhere; `--json` on every read; `NO_COLOR` respected.

```
bearing                               # status dashboard (default command)
bearing next                          # the frontier: BUILD / DECIDE / TRIAGE
bearing backlog "..."                 # drop a backlog item, zero ceremony
bearing backlog                       # bare: list the backlog
bearing new <type> "title" [--project X]   # create a ticket  (alias: create, add)
bearing ls [--build|--design|--blocked|--ready|--project X|--query "..."|--flat|--json]
bearing show <id> [--full|--json]
bearing edit <id>
bearing retitle <id> "..."            # owns the rename; id survives
bearing close <id>                    # asymmetric by type    (alias: done)
bearing close --map <project>         # refuses while any ticket names it
bearing rm <id>                       # delete without closing (alias: delete)
bearing triage <id> --to <project> | --ticket | --drop
bearing fog [<project>]               # patches, and which tickets are chasing each
bearing fog --repoint <id> <patch>    # fix a drifted clears anchor
bearing check                         # integrity pass
bearing init                          # config + install the skill
bearing config <key>[=<value>]
bearing completion <shell>
```

This listing is what `--help` shows, which is why `--confirm` is absent from it — see
[The dry run is undocumented on purpose](#the-dry-run-is-undocumented-on-purpose).

`bearing note` from the first draft is now `bearing backlog`, named for where it puts things rather than for
what it feels like doing. "Note" was borrowed vocabulary and it undersold the folder — it suggested a scrap,
and the section above argues these are often the opposite. `bearing backlog` also earns a bare form: with no
argument it lists, which is what you want immediately before triage.

`bearing check` is the integrity pass: dangling `blocked-by` (error), dangling `project` (error), design
tickets with no `project` (error), unknown types (error), duplicate ids (error), dangling `clears` (warning),
Trail rows for tickets that still exist (warning). It has no `--fix`. Every warning it emits prints the exact
command that resolves it, which is better than a bulk fixer for the same reason the close dry run is better
than a prompt: the operator ends up with commands they chose and can read back, rather than a diff a flag
produced.

### No archaeology command

An earlier draft had `bearing whence <id>` — given an id, find the commit that deleted the ticket and recover
what it said. Cut entirely.

The reasoning is a general one and worth keeping, because this kind of command will be proposed again. Making
`whence` reliable meant imposing real constraints on everything around it: full clone depth, care about how
branches merge, full-length ids everywhere instead of the 3–4 character prefixes the rest of the CLI accepts,
and one tracker per repo for a second reason. Those are constraints on the daily-use design, paid permanently,
to support a command that gets run rarely and always in a forensic mood — the mood where you are already
prepared to open git.

And it was never the only way to get the answer. `git log --diff-filter=D -- '*<id>*'` is a one-liner, and it
degrades honestly: where history is shallow it says so in git's own vocabulary rather than in a bearing error
message that has to explain the same thing. Principle 1 ends with "Git remembers," and that is a statement
about where the record lives, not a promise that bearing will fetch it.

What remains is the Trail table, which is the archaeology that is actually consulted — in the moment, by
someone working the map, for decisions that are still shaping the work. That was always the useful half.

## The skill

Bearing ships its own `wayfinder` variant covering both modes — charting a map from a loose idea, and working
through one a ticket at a time.

The part neither source skill covers is the graduation step. **Resolving one design ticket typically yields a
short ordered run of build tickets**, and that is the unit the skill has to guide. It is smaller and more
frequent than to-tickets' top-down decomposition and narrower than to-spec's one-feature spec, and it needs:

- **from to-tickets** — vertical slicing with `blocked-by` wired in one pass, and expand–migrate–contract as
  the escape hatch for changes that cannot slice vertically;
- **from to-spec** — the Done-when rigor: an assertion someone could check, not an intention.

These do not compose as cleanly as they look. to-tickets assumes sibling slices of a known feature, so
"independently demable" is achievable. Wayfinder emits build tickets as fog clears in unrelated areas, so you
get a scattering rather than a decomposition: `blocked-by` does more work here, and demability is an
aspiration for the last slice rather than a rule for every one.

What the skill deliberately does **not** carry over from to-spec is the testing-seam discipline, because
`## Verification` is gone. That discipline is real and still needed; it belongs to whatever turns a build
ticket into the repo's own spec. The bearing skill's job ends at a ticket someone could pick up — it should
hand off explicitly rather than half-doing the next step.

### Installing it

`bearing init` writes the skill into the target repo — `.agents/`, or `.claude/` where that is what the repo
uses — alongside setting the tracker path. Owning installation rather than shipping a plugin keeps the skill
versioned with the tracker it describes, and means a repo that adopts bearing gets the method in the same
gesture as the tool.

Worth cribbing the wizard ergonomics from [vercel-labs/skills](https://github.com/vercel-labs/skills), which
has already solved the boring parts: detecting which agent directory convention a repo uses, writing without
clobbering, and re-running to update. Reading how `skills add` handles those is a research task, not a
decision — the shape above is settled either way.

## Non-goals

Explicitly rejected during design, and worth keeping rejected:

- **Task hierarchy** (epic → task → subtask). Project scoping is the only grouping.
- **Priority integers.** Ranking is derived from the blocking graph and fog.
- **A completion/archive state.** Close is delete.
- **A claim or status field.** Races are tolerated; a claim visible only after merge is not a lock.
- **Cross-repo trackers.** One tracker per repo, always committed.
- **External sync** (GitHub, Shortcut).
- **AFK/HITL scheduling.** Real (research fans out to parallel subagents, grilling cannot), but not encoded
  until it hurts.
- **Knowing anything about the repo's build.** No gate command, no verification config, no validator
  discovery. Principle 7.
- **Archaeology.** No `whence`, no history search, no recovery of deleted tickets. Git remembers; bearing does
  not wrap it.
- **Interactive prompts anywhere but `init`.** Every other command is fully operable by an agent, which means
  no question it cannot answer. Where a second look is genuinely warranted, the mechanism is a dry run and a
  `--confirm` re-run.

## Configuration

One key.

```
tracker: .scratch
```

That is the whole of it. Everything the first draft wanted config for — what counts as durable, the gate
command, where specs live — turned out to be either prose a human writes in the map's Notes or a thing bearing
should not know. A tool with one config key does not need a config file format debate, and `bearing config`
exists mostly so `bearing init` has somewhere to write.

## Settled

Twelve questions have closed across the last three rounds — config shape (one key), build-close verification
(nothing), anchor drift (detect, print the command, never guess), skill install (`bearing init`), stub maps
(allowed: a destination plus one patch), bebop migration (one-time manual, which is the constraint that lets
the on-disk format keep moving until it happens), where the trail goes when a map closes (nowhere — the map
outlives the fog and then is deleted), whether `project` earns its keep on build tickets (yes — it is how the
tracker knows a map is still needed), archaeology (cut), and the three below.

**`bearing new design` with no project is an error.** It names the maps that exist so the next command is
obvious, and stops. Not a prompt, not a default, not an implicitly created map.

**`close --map <project>` stays a flag, not an overload.** `close <id>` is the command anyone will type a
hundred times more often, and ids and map stems are different enough kinds of thing that resolving one argument
as either would make the common case ambiguous to save a flag on the rare one.

### The dry run is undocumented on purpose

`--confirm` is documented **in this repo and nowhere else**. It does not appear in `bearing close --help`, it
does not appear in the shipped skill, and no error message mentions it before the dry run has run. The only
place a caller learns the flag is the last line of the dry-run output — the output that also contains the trail
row and the fog patch.

That is the whole mechanism. The reason to make someone look at the trail row before deleting the ticket is
that the row is where the mistake hides, and an agent that knows `--confirm` up front will go straight to it
and never read the row. The flag is not a safety interlock; it is a receipt that the review payload was on
screen. Advertising it in help text converts a forced read into an optional one and the feature evaporates.

This is deliberately weaker than it sounds, and worth being honest about: an agent that has already closed a
ticket this session knows the flag and will skip ahead. The bet is that most sessions start cold, so most
closes pay the two-command cost, and re-learning it each time is the correct outcome rather than friction to
optimize away. It is a nudge with good odds, not an enforcement mechanism — anything stronger would need state,
and state to make a human look at something is worse than the mistake it prevents.

The corollary constrains the skill: the bearing skill describes `bearing close <id>` and stops. If the skill
teaches the flag, every agent knows it before its first close, and the design above is decorative.

## Open questions

None blocking. The next round is implementation.
