# Bearing

A file-based issue tracker and CLI for exploring a **fog of war**: work too large for one agent session, where
the route to the destination is not yet visible.

The name is the method. You take a bearing, walk it, and take another when the view changes.

**The read path is partially built.** `packages/core` discovers the nearest tracker, acquires all
three tracker directories without discarding malformed documents, and projects valid tickets for `apps/cli` to
render or emit as `--json` ([Core returns values (ADR 0019)](./docs/adr/0019-core-returns-values-only-the-cli-renders.md)
is what keeps the two apart). Setup status lives in
[Setup and the shipped skill](./docs/capabilities/08-setup-and-the-skill.md). Derived map, fog, trail, and
integrity analysis remains designed, not built.

## What it is

Bearing holds what has been committed to and not yet finalized into the repository, and nothing else. An item
leaves the moment its reasoning lands somewhere durable — deleted, not archived, in the same change that lands
the work. Git remembers the rest.

Work that is already specifiable is a **build ticket**. Work that is a question is a **design ticket**, and it
belongs to a **map**: a destination, the fog between here and it, and the trail of what has already been
settled. The frontier — what to do next — is derived on every run and stored nowhere.

## Lineage

It descends from bebop's local Markdown tracker and its `wayfinder` skill, which in turn descend from Matt
Pocock's `wayfinder`. It takes its command ergonomics — not its task philosophy — from
[dex](https://dex.rip).

The inversion is the whole reason bearing exists as its own tool. In bebop the tracker is scaffolding
deliberately excluded from the product. Here the tracker **is** the product, so everything bebop hardcoded had
to be split into three layers:

| Layer         | Example                                                            | Where it lives           |
| ------------- | ------------------------------------------------------------------ | ------------------------ |
| **Mechanism** | close = delete; a blocker is satisfied when it no longer exists    | ships with bearing       |
| **Policy**    | what counts as durable _here_ — decision records? capability docs? | a map's notes, as prose  |
| **Method**    | wayfinder; when to chart a map at all                              | a skill bearing installs |

Policy shrank the most. It was going to be configuration bearing reads; it is prose bearing never parses.
Bearing has no configuration: the tracker lives in the nearest ancestor's `.bearing/`.

## Non-goals

There is no task hierarchy, no priority field, no completion state, no claim, no external sync, and no
knowledge of how your repository builds itself. The full list, and what each rejection costs, is
[`ABSTRACT.md`](./ABSTRACT.md) §5.

## Documentation

| If you need                                | Read                                         |
| ------------------------------------------ | -------------------------------------------- |
| What bearing is and what "done" looks like | [`ABSTRACT.md`](./ABSTRACT.md)               |
| What bearing does for its user             | [`docs/capabilities/`](./docs/capabilities/) |
| What a word means                          | [`CONTEXT.md`](./CONTEXT.md)                 |
| Why something is the way it is             | [`docs/adr/`](./docs/adr/)                   |
| Why something that looks broken isn't      | [`docs/gotchas.md`](./docs/gotchas.md)       |

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build:

```bash
vp run -r build
```
