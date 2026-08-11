# Bearing — a tracker for a fog of war

**Primary use case:** Work too large for one agent session, where the route to the destination is not yet visible

**Primary caller:** An agent, at a shell, on every turn — with a human reading the same output

**Runtime:** Bun, one bundled entry point

**Distribution:** One package exposing a `bearing` binary — linked from a clone today, published later

**Storage:** Markdown files in the repository being worked on, committed alongside the work

This is the north star: what bearing is, why it exists, and what it must and must not do. It says nothing about
how far along any of it is, or about the shape of any particular command — those belong to the capability
catalogue and to the tracker, and a north star that carried them would need editing every week. It is
deliberately short. The rest of the documentation hangs off it:

- the vocabulary it uses is defined in [`CONTEXT.md`](./CONTEXT.md);
- what each capability delivers and where it stands is in [`docs/capabilities/`](./docs/capabilities/);
- the decisions behind it are in [`docs/adr/`](./docs/adr/);
- behaviour that looks like a defect and is not is in [`docs/gotchas.md`](./docs/gotchas.md);
- what is committed to and not yet finished is in the tracker.

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

Bearing must:

- store the whole tracker as Markdown in the repository being worked on, committed alongside the work;
- capture an untriaged item with no fields to fill in and no decision to make;
- give every item an id that survives for the item's whole life, through triage, retitling, and reprojecting;
- triage an item to a small set of verdicts, one of which is deliberately leaving it alone;
- hold tickets of both types, with their prose edited directly rather than through the tool;
- express blocking by id, freely across projects;
- read a hand-written map and never write one;
- derive the frontier on every run rather than storing it anywhere;
- rank by what a ticket unblocks, and by nothing else;
- close anything by deleting it, in the same change that lands the work;
- gate a design close on the map's trail, so the bookkeeping bearing cannot judge is read before deletion;
- report what is inconsistent, and name the command that fixes each thing it can;
- install its own method into a repository alongside itself;
- run without git and inside a directory that is not a repository.

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

One separation carries the design: **the domain returns values, and only the interface turns a value into a
string.** Nothing in the domain imports a terminal, chooses an output format, or knows whether the caller wants
colour. That is what lets a human reading a terminal, an agent reading `--json`, and any later non-terminal
caller share one domain and disagree about nothing — see
[Core returns values; only the CLI renders (ADR 0019)](./docs/adr/0019-core-returns-values-only-the-cli-renders.md).

The domain offers three kinds of operation and no others:

- **Reads** — resolve an item, list what matches, derive the frontier, report what is inconsistent.
- **Plans** — turn a requested mutation into a value describing exactly what it would change.
- **Applies** — carry out a plan.

Every mutation has both a plan and an apply, whether or not any caller ever sees the plan. That is what makes a
dry run a rendering choice rather than a second code path, and it is why the one operation that shows its plan
needs no machinery the others lack.

What the domain is allowed to depend on is a short list, fixed on purpose: a filesystem, a path implementation,
and a clock. It reads the tracker's three directories once, keeps what it read losslessly enough to report what
is malformed, and exposes operations rather than the tracker itself — see
[Core exposes operations, not tracker internals (ADR 0027)](./docs/adr/0027-core-exposes-operations-not-tracker-internals.md).
