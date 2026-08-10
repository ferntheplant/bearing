# Bearing — a tracker for a fog of war

**Primary use case:** Work too large for one agent session, where the route to the destination is not yet visible

**Primary caller:** An agent, at a shell, on every turn — with a human reading the same output

**Runtime:** Bun, one bundled entry point

**Distribution:** One published package exposing a `bearing` binary

**Storage:** Markdown files in the repository being worked on, committed alongside the work

This is the north star: what bearing is, why it exists, what it must and must not do, and what "done" looks
like. It is deliberately short. The rest of the documentation hangs off it:

- the vocabulary it uses is defined in [`CONTEXT.md`](./CONTEXT.md);
- what each capability delivers and where it stands is in [`docs/capabilities/`](./docs/capabilities/);
- the decisions behind it are in [`docs/adr/`](./docs/adr/);
- behaviour that looks like a defect and is not is in [`docs/gotchas.md`](./docs/gotchas.md).

---

## 1. Summary

Bearing is a file-based issue tracker and CLI for exploring a fog of war. It holds what has been committed to
and not yet finalized into the repository, and nothing else.

The system's fundamental unit is a **tracker**:

```text
one tracker
= one directory, committed to one repository
+ untriaged backlog items, which carry no fields at all
+ tickets, which are commitments
+ maps, each of which is a project
```

Work divides in two, and the discriminator is a single sentence: **a design ticket closes as an artifact, a
build ticket closes as a commit.** Build tickets are work that was specifiable. Design tickets are questions,
and a question belongs to a map — a destination, the fog between here and it, and the trail of what has already
been settled.

Nothing records what to do next. The **frontier** — ready build work, ready decisions, and the size of the
backlog — is derived on every run from the files on disk. Closing anything is deleting it, in the same change
that lands the work.

## 2. Motivation

Existing trackers model a workflow: states, assignees, priorities, and a completed pile that grows forever.
That is the wrong shape twice over for the work bearing is for.

**The work is not decomposable yet.** An agent session can execute a specified change. It cannot execute "figure
out how the thing should work", and a tracker that only holds specifiable work has nothing to say until the
hard part is over. Bearing tracks the decisions themselves as first-class work, and tracks the fog around them
as prose that is deliberately too coarse to be a ticket.

**The tracker is a liability the moment it outlives the moment.** A tracker that keeps its history becomes a
second, worse copy of the repository's own record, and everything in it has to be filtered before it can be
read. Bearing's answer is that an item leaves when its reasoning lands somewhere durable — deleted, not
archived. Git already holds history, and holds it with the diff attached.

**The caller is an agent.** Every command has to be answerable without a human at the keyboard, which rules out
prompts and rules out anything that blocks. It also makes startup performance a product concern, because the
tool is invoked on every turn.

Bearing descends from bebop's local Markdown tracker, where the tracker was scaffolding deliberately excluded
from the product. Here it is the product, so what bebop hardcoded splits into three layers: **mechanism** ships
with bearing, **policy** is prose in a map's notes that bearing never parses, and **method** is a skill bearing
installs.

## 3. Product principles

### 3.1 The tracker is an in-the-moment tool, not an audit

It answers one question: what has been committed to and not yet finalized into the repository? A ticket leaves
the moment its reasoning lands somewhere durable — deleted, not archived. Git remembers.

### 3.2 The frontier is rendered, never stored

No file says what the next work is. Everything derivable is derived.

### 3.3 Nothing outside the tracker links into it

Source, decision records, and documentation cite durable artifacts, never tickets. The tracker's own
documentation and the skill it installs are the exception, since they have to know where it is.

### 3.4 Prose refers by title; ids are handles

An id is for typing at a shell or a file picker. A title is what a human reads.

### 3.5 Bearing reads prose and checks it, and never writes prose

Maps are hand-edited. The tool validates.

### 3.6 A map is a decisioning instrument

It tracks the fog between here and the destination and the trail of what has been settled. Only questions are
charted as fog; the tickets a mapping pass produces from them may be of either type.

### 3.7 Bearing stops at the repo's edge

It tracks ideas and commitments before they are canonicalized. It knows nothing about how the repository
builds, tests, or validates itself.

### 3.8 Every command is operable by an agent

No prompts, no TTY assumptions, no question a non-human caller cannot answer. Where a second look matters, it is
a dry run and a re-run: closing a design ticket.

## 4. Goals

The MVP must:

- store the whole tracker as Markdown in the repository, in three flat directories;
- capture an untriaged item in one command with no fields to fill in;
- give every item a six-character id that lives only in its filename and survives for the item's life;
- accept unambiguous id prefixes everywhere an id is accepted;
- triage an item to any of five verdicts, four of which are the same move plus frontmatter;
- create, list, show, and retitle tickets of both types, with their Markdown edited directly;
- resolve blocking by id across projects, treating a blocker that no longer exists as satisfied;
- parse a hand-written map for its fog patches and its trail, and never write one;
- derive the frontier on every run — ready build work, ready decisions grouped by project, backlog size, and any
  map left fogbound;
- rank by transitive gate count and by nothing else;
- close a build ticket by deleting it and stripping its id from every blocker list;
- close a design ticket only against a trail row with a non-empty outcome, showing that row verbatim first;
- make only design-ticket closing a dry run that a re-run applies, with every other mutation applying directly;
- close a map, refusing while any ticket still names it;
- report every integrity error and warning, each warning carrying the command that resolves it;
- emit `--json` on every read and respect `NO_COLOR`;
- install its own skill into the repository during setup, without clobbering local edits;
- run without git, without a subprocess, and inside a directory that is not a repository;
- start fast enough to be invoked on every agent turn.

## 5. Non-goals

The MVP will not:

- model task hierarchy — epic, task, subtask;
- carry priority integers, points, or severity;
- have a completion state, an archive, or any recovery of a deleted item;
- have a claim or status field — races are tolerated, and a claim visible only after a merge is not a lock;
- track work across repositories, or hold a tracker outside the repository it is about;
- sync with GitHub, Linear, Shortcut, or any external system;
- schedule around who is at the keyboard, or model which work can fan out;
- know anything about how the repository builds, tests, or validates itself — no gate command, no verification
  configuration, no validator discovery;
- write the repository's own execution contract for a build ticket;
- search git history, recover a deleted ticket, or wrap git in any way;
- edit a map;
- prompt interactively;
- ship a web interface, a daemon, or a server.

## 6. Shape

```text
packages/core     the domain — no terminal, no strings, no bun, no git
apps/cli          the interface — owns effect/unstable/cli, published as the binary
skills/           the bearing-wayfinder skill, copied into a target repo at setup
```

One rule makes the separation real: **core returns values, and only the CLI turns a value into a string.**
Closing a design ticket returns a plan holding the trail row, the fog patches, the file to delete, and the blocker
edits it would make. The CLI renders that as the dry run; `--json` serializes the same value; a future
non-terminal interface returns it directly. Every mutation still has separate planning and applying operations;
direct mutations run both in one invocation.

Core depends on a filesystem, a path implementation, and a clock. That is the complete list.

Core exposes domain operations rather than a loaded tracker or its internal analyses. Each tracker operation
reads the three directories once into a private, lossless observation that retains exact source and malformed
evidence; parsers, indexes, the blocking graph, and source rewriting stay behind that interface.

On disk:

```text
.bearing/
  backlog/<id>-<slug>.md    untriaged — no frontmatter; being here is the status
  tickets/<id>-<slug>.md    every ticket, design and build
  maps/<project>.md         Destination / Notes / Trail / Not yet specified / Out of scope
```

At the surface. Verb ergonomics borrowed from [dex](https://dex.rip); aliases everywhere; `--json` on every
read; `NO_COLOR` respected. This is what `--help` shows, which is why the flag that applies a design close is absent
from it:

```text
bearing                                    # the frontier (default; same output as `bearing next`)
bearing next                               # the frontier: BUILD / DECIDE / TRIAGE
bearing backlog "..."                      # drop a backlog item, zero ceremony
bearing backlog                            # bare: list the backlog
bearing new <type> "title" [--project X]   # create a ticket  (alias: create, add)
bearing ls [--build|--design|--blocked|--ready|--project X|--query "..."|--flat|--json]
bearing show <id> [--full|--json]
bearing retitle <id> "..."                 # owns the rename; id survives
bearing close <id>                         # asymmetric by type    (alias: done)
bearing close --map <project>              # refuses while any ticket names it
bearing rm <id>                            # delete without closing (alias: delete)
bearing triage <id> --to <project> | --ticket | --drop
bearing fog [<project>]                    # the patches on a map
bearing check                              # integrity pass
bearing init                               # create .bearing + install the skill
bearing completion <shell>
```

Closing a map stays a flag rather than an overload of `close <id>`: closing a ticket is the command anyone types
a hundred times more often, and resolving one argument as either an id or a map name would make the common case
ambiguous to save a flag on the rare one.

## 7. Build order

**The read path first, end to end.** Ids, the store, map parsing, and listing — enough to point at a real
tracker and get output, with the seam exercised before there is anything to unpick. The frontier follows once
the graph and ranking exist. Mutations come last, because they are the only part that can damage a tracker, and
setup and publishing come after that.

That order is available because the ranking and integrity criteria — the ones most likely to be wrong on the
first attempt — are reachable against a hand-written tracker and no mutation code at all.

Nothing here reorders §5. Read-path-first is a build order, not a reduction in scope.

The first slice settled the module-level ordering inside core; see
[Core exposes operations, not tracker internals (ADR 0027)](./docs/adr/0027-core-exposes-operations-not-tracker-internals.md).

## 8. MVP acceptance criteria

The MVP is acceptable when each of these holds. Every criterion is owned by exactly one capability in
[`docs/capabilities/`](./docs/capabilities/), so a criterion nobody claims is a visible gap rather than a silent
one.

1. `bearing init` in a directory with no tracker creates `.bearing/` and installs `bearing-wayfinder` at the
   literal physical path `.agents/skills/bearing-wayfinder`.
2. Re-running `bearing init` updates an untouched installed skill; a locally edited skill is left byte-for-byte
   unchanged and reported as a skipped update.
3. `bearing backlog "..."` writes an item carrying an id and no frontmatter, in one command with no other input.
4. Bare `bearing backlog` lists the backlog.
5. `bearing triage <id> --ticket` promotes an item to an unprojected build ticket, with the id unchanged.
6. `bearing triage <id> --to <project>` promotes it into an existing map, with the id unchanged and nothing but
   frontmatter differing.
7. `bearing triage <id> --drop` deletes the item.
8. `bearing new build "..."` creates a build ticket belonging to no project.
9. `bearing new design "..."` with no project fails, names the maps that exist, and creates nothing.
10. `bearing retitle <id> "..."` renames the file, preserves the id, and touches no other file.
11. An unambiguous id prefix resolves everywhere an id is accepted; an ambiguous one errors and names the
    candidates.
12. A map holding a destination and a single fog patch validates as a project.
13. `bearing fog` lists every patch on a map, and rewording a patch's heading changes nothing but the text it
    prints.
14. `bearing next` prints BUILD, DECIDE, and TRIAGE, with BUILD above DECIDE and TRIAGE showing a count.
15. A ticket with an unsatisfied blocker is absent from BUILD; deleting the blocker makes it present with no
    other edit.
16. Between two ready tickets, the one that transitively unblocks more ranks higher; a fog-complete map is
    absent from DECIDE while its build tickets remain open.
17. Every read command accepts `--json` and emits the values it rendered.
18. A map with fog and no open design tickets is reported as fogbound, including when BUILD and DECIDE are both
    empty.
19. `bearing close <id>` on a design ticket prints the trail row verbatim, the file it would delete, and the
    tickets it would unblock — and changes nothing.
20. Re-running that close deletes the file and strips the id from every blocker list.
21. Closing a design ticket refuses when its map has no trail row for the id, or when that row's outcome is
    empty.
22. Closing a build ticket deletes it on the first invocation without inspecting the working tree, the commit,
    or the map.
23. `bearing close --map <project>` refuses while any ticket names the map, and otherwise deletes the file on
    the first invocation.
24. `bearing check` reports every parse failure and every integrity error class — dangling blocker, dangling
    project, design ticket with no project, unknown type, duplicate id — and the one warning class, a trail row
    for a ticket that still exists.
25. That warning prints the exact command that resolves it, and there is no bulk-fix flag.
26. Starting in any nested directory, every tracker command finds the nearest ancestor's `.bearing/` without
    git; no command spawns a subprocess, and a missing or malformed nearest tracker fails loudly.
27. Every mutation except design-ticket closing applies on its first invocation, and no shipped artifact — help
    output, skill text, error message — names the flag that applies a design close.

## 9. Decision summary

The design commits to:

- **Closing is deletion**, and the tracker holds only what is not yet canonicalized
  ([ADR 0001](./docs/adr/0001-the-tracker-holds-only-what-is-not-yet-canonicalized.md),
  [ADR 0002](./docs/adr/0002-nothing-outside-the-tracker-links-into-it.md)).
- **Everything derivable is derived** — the frontier, readiness, ranking, and whether a map is fogbound
  ([ADR 0003](./docs/adr/0003-the-frontier-is-derived-never-stored.md),
  [ADR 0004](./docs/adr/0004-ranking-is-derived-from-the-blocking-graph.md),
  [ADR 0034](./docs/adr/0034-a-fogbound-map-is-reported.md)).
- **Three flat directories, and a project is a map file**, with identity living only in the filename
  ([ADR 0005](./docs/adr/0005-three-flat-directories-and-a-project-is-a-map-file.md),
  [ADR 0006](./docs/adr/0006-the-filename-is-the-only-place-an-id-appears.md)).
- **Two ticket types and no status field**, discriminated by how they close
  ([ADR 0007](./docs/adr/0007-two-ticket-types-discriminated-by-how-they-close.md),
  [ADR 0008](./docs/adr/0008-backlog-items-carry-no-frontmatter.md)).
- **Maps are hand-written and machine-checked**, and nothing in the tracker points at a patch of fog
  ([ADR 0009](./docs/adr/0009-bearing-reads-maps-and-never-writes-them.md),
  [ADR 0010](./docs/adr/0010-the-trail-is-append-only-and-a-row-is-a-pointer.md),
  [ADR 0013](./docs/adr/0013-a-map-lives-until-its-last-ticket-closes.md),
  [ADR 0033](./docs/adr/0033-nothing-points-at-a-fog-patch.md)).
- **Mapping and walking alternate**, a patch leaving a pass as a ticket, as a decision landed on the spot, or as
  fog carrying the reason it survived, with nothing structured written before the thing it records is finished
  ([ADR 0031](./docs/adr/0031-mapping-and-walking-alternate.md),
  [ADR 0032](./docs/adr/0032-structure-in-the-map-is-written-only-at-completion.md)).
- **Bearing stops at the repo's edge**, with no configuration and the nearest ancestor's `.bearing/` as the
  fixed tracker
  ([ADR 0014](./docs/adr/0014-bearing-stops-at-the-repos-edge.md),
  [ADR 0028](./docs/adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)).
- **Only design-ticket closing is a dry run and re-run**, with every other mutation direct, the applying flag
  deliberately undocumented, and interrupted applies ordered toward visible residue rather than rollback
  ([ADR 0016](./docs/adr/0016-the-confirm-flag-is-undocumented-on-purpose.md),
  [ADR 0025](./docs/adr/0025-mutations-are-ordered-not-atomic.md),
  [ADR 0029](./docs/adr/0029-only-design-ticket-closing-is-a-dry-run.md)).
- **No archaeology and no subprocesses**
  ([ADR 0017](./docs/adr/0017-no-archaeology-git-remembers.md),
  [ADR 0018](./docs/adr/0018-bearing-never-spawns-a-subprocess.md)).
- **Process exit status is binary** — zero when the requested operation succeeds, one for every refusal or
  failure ([Exit status is binary (ADR 0035)](./docs/adr/0035-exit-status-is-binary.md)).
- **Core exposes operations and returns values, one package publishes, Bun only**, on Effect's pinned and
  confined unstable CLI
  ([ADR 0019](./docs/adr/0019-core-returns-values-only-the-cli-renders.md),
  [ADR 0020](./docs/adr/0020-one-published-package-and-core-stays-private.md),
  [ADR 0021](./docs/adr/0021-bun-only-no-node-fallback.md),
  [ADR 0022](./docs/adr/0022-effects-unstable-cli-pinned-exactly-and-confined.md),
  [ADR 0027](./docs/adr/0027-core-exposes-operations-not-tracker-internals.md)).
- **Bearing installs its own skill**, versioned with the binary, in one owned location that updates only while
  untouched, carrying the portable method alone and leaving every repo-specific referent to the repo
  ([Bearing installs its own skill (ADR 0023)](./docs/adr/0023-bearing-installs-its-own-skill.md),
  [One owned skill installation, updated only while untouched (ADR 0036)](./docs/adr/0036-one-owned-skill-installation-updated-only-while-untouched.md),
  [The skill teaches method; the repo supplies the referents (ADR 0037)](./docs/adr/0037-the-skill-teaches-method-and-the-repo-supplies-the-referents.md)).
- **Three frontmatter fields, and the body is prose**, with the id and slug rules that
  [ADR 0006](./docs/adr/0006-the-filename-is-the-only-place-an-id-appears.md) assumes
  ([ADR 0024](./docs/adr/0024-three-frontmatter-fields-and-the-body-is-prose.md)).
- **Tracker files are edited directly**, with bearing owning retitles because filenames carry identity
  ([ADR 0030](./docs/adr/0030-tracker-files-are-edited-directly.md)).
