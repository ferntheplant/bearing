# Bearing

A file-based issue tracker and CLI for exploring a **fog of war**: work too large for one agent session, where
the route to the destination is not yet visible.

The name is the method. You take a bearing, walk it, and take another when the view changes.

**The read path is partially built.** The [capability catalogue](./docs/capabilities/) records what runs today.
[Core returns values (ADR 0019)](./docs/adr/0019-core-returns-values-only-the-cli-renders.md) keeps the domain and
rendering apart; setup status lives in
[Setup and the shipped skill](./docs/capabilities/08-setup-and-the-skill.md).

## What it is

Bearing holds what has been committed to and not yet finalized into the repository, and nothing else. An item
leaves the moment its reasoning lands somewhere durable — deleted, not archived, in the same change that lands
the work. Git remembers the rest.

Work that is already specifiable is a **build ticket**. Work that is a question is a **design ticket**, and it
belongs to a **map**: a destination, the fog between here and it, and the trail of what has already been
settled. The frontier — what to do next — is derived on every run and stored nowhere.

## Install

Bearing is on no registry. You install it by linking a clone, which is a deliberate deferral rather than an
oversight — [Installation is a linked clone, and publishing is deferred (ADR 0038)](./docs/adr/0038-installation-is-a-linked-clone-and-publishing-is-deferred.md)
is why. It needs [Bun](https://bun.com) and [Vite+](https://viteplus.dev).

```bash
git clone https://github.com/ferntheplant/bearing.git
cd bearing
vp install
vp run -r build
cd apps/cli && bun link
```

That puts a `bearing` binary on your `PATH`, usable from anywhere:

```bash
cd ~/some/other/project
bearing init   # create .bearing/ and install the bearing-wayfinder skill
bearing        # list tickets
```

**The checkout is the installation**, so leave it where it is: the linked binary runs out of `apps/cli/dist` and
resolves its dependencies from the clone's `node_modules`. Moving or deleting the clone breaks the command.
Rebuilding is what updates it — the link survives, because it points at a path the build rewrites in place.

```bash
git pull && vp install && vp run -r build
```

To remove the binary, run `bun unlink` in `apps/cli`.

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
