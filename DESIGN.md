# Bearing — design draft

**Status: draft.** This records what four rounds of design conversation settled, and marks what it did not.
Nothing here has been built.

Bearing is a file-based issue tracker and CLI for exploring a **fog of war**: work too large for one agent
session, where the route to the destination is not yet visible. It descends from bebop's local Markdown tracker
and its `wayfinder` skill, which in turn descend from Matt Pocock's `wayfinder`. It takes its command
ergonomics — not its task philosophy — from [dex](https://dex.rip).

The name is the method: you take a bearing, walk it, and take another when the view changes.

## The inversion

In bebop the tracker is scaffolding deliberately excluded from the product. In bearing the tracker **is** the
product, so everything bebop hardcodes has to be split into layers:

| Layer         | Example                                                         | Where it lives           |
| ------------- | --------------------------------------------------------------- | ------------------------ |
| **Mechanism** | close = delete; a blocker is satisfied when it no longer exists | ships with bearing       |
| **Policy**    | what counts as durable _here_ — `docs/adr/`? capability docs?   | per-repo config          |
| **Method**    | wayfinder; when to chart a map at all                           | a skill bearing installs |

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

## Data model

```
.scratch/
  backlog/<id>-<slug>.md          # untriaged — no frontmatter; being here is the status
  tickets/<id>-<slug>.md          # build tickets only
  <project>/
    map.md                        # Destination / Notes / Route / Not yet specified / Out of scope
    tickets/<id>-<slug>.md        # design + build
```

### Identity

Every item is named `<id>-<slug>.md`, where `id` is an 8-character nanoid over `[0-9a-z]` and `slug` is derived
from the title. **The filename is canonical** — the id appears nowhere else, so it cannot desync.

The id is identity for life. A backlog item promoted into a project keeps it across the `git mv`; a retitle
changes only the slug half. Because retitles change the filename, **bearing owns rename** — doing it by hand is
how you get an id whose slug lies.

The CLI accepts unambiguous id prefixes, so 3–4 characters is usually enough to type.

### Tickets

```yaml
---
type: design # design | build
blocked-by: [k2m9x4qp] # ids only; omit when empty
clears: [what-ein-is-actually-told] # design only, advisory; omit when empty
---
```

Three fields, one of them advisory. There is **no status field**: a ticket goes from existing to deleted in a
single PR, so `open` was the only value it could hold, and a field with one value is not a field.

The two types are defined by how they close:

> **A design ticket closes as an artifact. A build ticket closes as a commit.**

That test is the whole discriminator. Manual work that unblocks a decision — provisioning access, signing up
for a service so its API can be judged — is `design`, because its outcome is knowledge.

Finer-grained method (is this settled by conversation? by a rough prototype? by reading third-party docs?) is
written into the ticket body by whoever writes it. Bearing does not model it.

**Design tickets exist only inside a project.** Top-level `tickets/` is build-only, so the unprojected frontier
is always directly actionable.

### Ticket bodies

A **design** ticket's body is the question, sized to one agent session:

```markdown
## Question

<the decision or investigation this ticket resolves>
```

A **build** ticket carries four sections:

```markdown
## Background <!-- why, citing the durable artifacts that decided it -->

## Scope <!-- what changes -->

## Verification <!-- the testing seam: where the assertions are made from -->

## Done when <!-- checkable assertions, including the repo's gate command -->
```

`Verification` is the piece bebop lacked. `Done when` says what must be true; `Verification` says where it is
proven from, preferring an existing seam and naming new ones at the highest architectural level that works.
That is what makes a ticket executable by an agent rather than merely legible.

The repo's gate command is policy, so bearing can template it into `Done when` on creation.

### Backlog items

No frontmatter at all — being in `backlog/` is the status. A title and a couple of sentences; if it needs more,
it is already sharp enough to be a ticket. Items still get ids, because the filename carries them and a handle
is needed for triage.

The backlog holds two things: untriaged findings, and **singleton fog** — one thing you cannot specify, which
under the design-tickets-need-a-project rule has nowhere else to live. It waits there until enough accumulates
to name a destination. "Leave it in the backlog" is a real triage verdict, not a failure to triage.

### The map

A project _is_ a map plus its tickets. Maps exist only where work is genuinely ill-defined; well-defined work
is build tickets at top level.

```markdown
# <Project name>

## Destination

<what reaching the end looks like — one or two lines>

## Notes

<domain; skills every session should consult; standing preferences>

## Route

<the table below>

## Not yet specified

<### headings, one per fog patch, prose beneath>

## Out of scope

<boundaries declared up front — never graduates>
```

Open tickets are **not listed** on the map; they are found by scanning `tickets/`. Two places to keep in step
means one of them rots.

### The Route table

Append-only, one row per design ticket closed, written by hand in the same commit that deletes the ticket and
lands the artifact. Chronological by construction, which is what makes it read as a route rather than a
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

The row is also the only permanent record of a deleted ticket. Its id is the archaeology key —
`git log --diff-filter=D` on it recovers the original question and everything the ticket considered.

This gives **Out of scope** a cleaner job than bebop's. It holds boundaries _declared_; the table holds
boundaries _discovered_. Neither explains itself twice.

### Fog

Patches are `###` headings under `## Not yet specified`, prose beneath, deliberately coarser than a ticket. The
test is unchanged: **ticket** when you can state the question precisely now, even if blocked; **fog** when you
cannot phrase it that sharply.

Bearing parses heading text and nothing else. The heading also gives each patch a real anchor
(`map.md#what-ein-is-actually-told`) that resolves in GitHub and editor previews, so tickets can link fog in
prose.

A design ticket points at fog with `clears:`, written at creation with no second wiring pass. **Fog links are
advisory, not referential** — a dangling `clears` warns but never fails, because fog rephrasing and fog
clearing are both normal. This is the deliberate looseness: no fog ids, no lifecycle, no partial-graduation
tracking.

Two things it buys, which are the whole point:

- **Ranking that isn't wrong.** Transitive gate count only sees _charted_ dependents, so a design ticket whose
  purpose is to burn off three patches of fog scores zero. Counting `clears` puts fog into the ranking.
- **A prompt at the right moment.** Closing a ticket that claimed to clear a patch asks whether it is still
  fogged. Graduation is the step that gets skipped, and this is the only moment anyone is looking at both the
  answer and the patch.

## Lifecycle

### Triage

Move each backlog item to the shallowest home that fits:

1. **Delete it** — not real, already fixed, duplicate.
2. **`tickets/<id>-<slug>.md`** — specifiable now, no project owns it. Build ticket.
3. **`<project>/tickets/…`** — belongs to a live map.
4. **A new project** — a nameable destination plus at least two things you cannot yet specify.
5. **Leave it** — singleton fog, waiting for company.

### Blocking

`blocked-by` names ids, which may live in any project — the decision frontier runs ahead of the build frontier,
so cross-project blocking is normal. **A ticket is unblocked when every id it names no longer exists**; an
absorbed blocker is a satisfied one. A dangling blocker is an error, unlike a dangling `clears`.

### Closing

Closing is deletion, in the same change that lands the work. What bearing checks is **asymmetric by type**,
because the two types have structurally different evidence:

**Build.** The durable artifact is the diff it shipped with, so there is nothing to cite — the deleting commit
_is_ the evidence, and it is recoverable. Bearing deletes the file and strips the id from every `blocked-by`.

**Design.** The artifact is a different file, and that link is not derivable. Bearing refuses to close unless:

- the project's Route table has a row for this id, and
- that row's Outcome column is non-empty.

Then it deletes and strips, and advises on any fog patches the ticket claimed to clear but which are still
present.

The human writes the row; bearing checks it exists. Bearing never edits `map.md`, which keeps the tool out of
the one file with real conflict potential.

Deleting the ticket inside the PR that lands the work is deliberate: a reviewer seeing
`- .scratch/…/k2m9x4qp-which-model-does-each-seat-run.md` in the diff is seeing the PR's claim about what it
finished.

### Map completion

A map is complete when **Not yet specified** is empty and no design ticket remains. At that point every Route
row points at a durable artifact, so the map contains no links into the tracker at all — it has stopped being
scaffolding.

So it closes like anything else: written to its durable home (repo policy — `docs/maps/`, wherever), deleted
from `.scratch/`. There is no archive concept inside the tracker.

Its remaining build tickets are just build tickets. Since the frontier renders BUILD flat and only groups
DECIDE by project, the project directory can dissolve into the general pool — **a project directory exists
exactly as long as it is foggy.**

## The frontier

Derived on every run, never stored. Three sections:

- **BUILD** — open, unblocked build tickets, flat, ranked by transitive gate count.
- **DECIDE** — open, unblocked design tickets, grouped by project, each group headed by its destination line
  and fog count. Ranked by gate count **plus fog cleared**.
- **TRIAGE** — backlog count and oldest item by git-add date. Load-bearing rather than hygiene, since this is
  where projects come from.

Build outranks decide overall: something already specified and unbuilt is the answer to "what next."

## CLI surface (draft)

Verb shape and ergonomics from dex; aliases everywhere; `--json` on every read; `NO_COLOR` respected.

```
bearing                          # status dashboard (default command)
bearing next                     # the frontier: BUILD / DECIDE / TRIAGE
bearing note "..."               # drop a backlog item, zero ceremony
bearing new <type> "title"       # create a ticket        (alias: create, add)
bearing ls [--build|--design|--blocked|--ready|--project X|--query "..."|--flat|--json]
bearing show <id> [--full|--json]
bearing edit <id>
bearing retitle <id> "..."       # owns the git mv; id survives
bearing close <id>               # asymmetric by type      (alias: done)
bearing rm <id>                  # delete without closing  (alias: delete)
bearing triage <id> --to <project> | --ticket | --drop
bearing fog [<project>]          # patches, and which tickets are chasing each
bearing whence <id>              # archaeology: the commit that deleted it, and what it landed
bearing check                    # integrity pass
bearing config <key>[=<value>]
bearing completion <shell>
```

`bearing check` is the integrity pass: dangling `blocked-by` (error), design tickets outside a project
(error), unknown types (error), duplicate ids (error), dangling `clears` (warning), Route rows for tickets that
still exist (warning).

## The skill

Bearing ships its own `wayfinder` variant covering both modes — charting a map from a loose idea, and working
through one a ticket at a time.

The part neither source skill covers is the graduation step. **Resolving one design ticket typically yields a
short ordered run of build tickets**, and that is the unit the skill has to guide. It is smaller and more
frequent than to-tickets' top-down decomposition and narrower than to-spec's one-feature spec, and it needs:

- **from to-tickets** — vertical slicing with `blocked-by` wired in one pass, and expand–migrate–contract as
  the escape hatch for changes that cannot slice vertically;
- **from to-spec** — the testing-seam discipline that fills `Verification`, and the Done-when rigor.

These do not compose as cleanly as they look. to-tickets assumes sibling slices of a known feature, so
"independently demable" is achievable. Wayfinder emits build tickets as fog clears in unrelated areas, so you
get a scattering rather than a decomposition: `blocked-by` does more work here, and demability is an
aspiration for the last slice rather than a rule for every one.

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

## Open questions

- **The policy config shape.** What "durable" means per repo — a list of paths? a predicate? — and how the gate
  command gets templated into `Done when`.
- **Does build close verify anything?** Deleting a build ticket in a commit with no other changes is
  suspicious. Advisory warning, or nothing?
- **Fog anchor drift.** Maps are hand-edited, so headings will be reworded. Advisory-only is the current answer;
  whether `bearing check` should offer to repoint `clears` is unsettled.
- **How the skill is installed** into a target repo — plugin, `skills add`, or a `bearing init` that writes it.
- **Stub projects.** Bebop used stub maps as holding pens for real-but-not-next destinations. Whether bearing
  keeps that, given a project now implies a live map, is undecided.
- **Bebop migration.** One-time manual conversion, which is the constraint that lets the on-disk format keep
  moving until it happens.
