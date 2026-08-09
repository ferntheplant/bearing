# Bearing — implementation outline

**Status: draft.** [`DESIGN.md`](./DESIGN.md) settles what bearing is. This is how it gets built, and it
records measurements rather than intentions where measurements were cheap to take. Nothing here is built yet.

## The stack, verified

Checked against the registry on 2026-08-09, because two of these differ from what you would guess:

| Package                | Version          | Notes                                     |
| ---------------------- | ---------------- | ----------------------------------------- |
| `bun`                  | 1.3.14           | already pinned in `devEngines`            |
| `effect`               | `4.0.0-beta.106` | `beta` dist-tag; `latest` is still 3.22.1 |
| `@effect/platform-bun` | `4.0.0-beta.106` | tracks core's beta line                   |
| ~~`@effect/cli`~~      | —                | **do not add**                            |

Two findings worth having up front.

**`@effect/cli` has no v4 and is not what you want.** Its latest is `0.77.0`, a v3-era package. In v4 the CLI
moved into core at `effect/unstable/cli`, exporting `Command`, `Flag`, `Argument`, `Param`, `Primitive`,
`GlobalFlag`, `HelpDoc`, `CliConfig`, `CliOutput`, `CliError`, `Completions`, and `Prompt`. Your recollection
of a `command` module was right; it just lives in core now. Adding `@effect/cli` would silently pull a v3
Effect into the tree.

**`Terminal`, `FileSystem`, and `Path` are top-level core modules** (`effect/Terminal`, `effect/FileSystem`,
`effect/Path`), with Bun implementations in `@effect/platform-bun` as `BunTerminal`, `BunFileSystem`,
`BunPath`, plus `BunRuntime`. There is also `BunChildProcessSpawner` and an `effect/unstable/process` module;
bearing needs neither, and the section on git below is why that turned out to matter.

Two things fall out of the module list for free. `Completions` means `bearing completion <shell>` is close to
a one-liner. And `Prompt` is exactly what `bearing init` needs — which makes principle 8 mechanically
enforceable rather than aspirational: **`Prompt` may be imported by the `init` command and nowhere else**, as
an `oxlint` `no-restricted-imports` rule. The repo already configures that rule, so it is one entry.

### The beta risk, and what absorbs it

`unstable/` plus `beta.106` means the CLI API will break between releases — that is what both labels are for.
Two mitigations, and they are cheap:

- **Pin exactly** in the root catalog, as the repo already does for everything else. Never a range on a beta.
- **Confine the blast radius.** Every `effect/unstable/cli` import lives in one package. That is not a new
  constraint invented for the beta; it is the core/interface seam described below, which we want anyway. The
  beta just raises its value — an API break becomes a diff in one directory instead of a migration.

## Startup time

Bearing gets invoked on every agent turn, so startup is a feature, not a nicety. Measured on this machine
(macOS/arm64, bun 1.3.14, node 22.23.1, 15 runs each, `--minify` where bundled). The shell harness floor was
14ms, subtracted in the right-hand column:

| Setup                                    | Wall     | Net      |
| ---------------------------------------- | -------- | -------- |
| `bun bare.ts` (a `console.log`)          | 31ms     | 17ms     |
| `node --experimental-strip-types`        | 72ms     | 58ms     |
| `bun` + `effect/unstable/cli`, unbundled | 77ms     | 63ms     |
| **`bun` + same, bundled (87K)**          | **36ms** | **22ms** |
| `bun build --compile` binary (61MB)      | 88ms     | 74ms     |

Three conclusions, one of them the opposite of what I expected:

**Bundling matters more than the runtime.** Unbundled, Effect costs 46ms of module resolution over bare bun.
Bundled, it costs 5ms. Effect is not slow to start; resolving several hundred small files is. So the build step
is the optimization, and once it exists the framework is nearly free.

**The standalone binary is the trap.** `bun build --compile` is the option that sounds fastest — no runtime
dependency, single artifact — and it is the slowest thing measured, 3× the bundled script, while being 61MB
against 87K. Loading a 61MB executable is not free, and on macOS there is likely per-exec signature checking on
top. It also multiplies the release matrix by every platform. Worth re-measuring on Linux before treating it as
settled, but on this evidence there is no case for it.

**Bun over node is real but second-order.** 41ms of the gap is runtime boot. Worth having, and bun is already
this repo's package manager, but it is not where the win is. It does mean bun is a hard runtime requirement,
which is a distribution question, below.

Budget to hold: **under 50ms wall for `bearing next` on a real tracker.** That leaves roughly 25ms over the
measured floor for reading and parsing every file in `.scratch/`, which is generous for a few dozen small
Markdown files and will stay generous, since the tracker is bounded by what a person can hold in their head.

Nothing threatens it, now that git is gone — see below.

### Bearing does not shell out to git

This started as a hot-path worry and ended as a deletion. Two features wanted git, and neither survived
contact with what it cost:

- **TRIAGE's "oldest item by git-add date"** needed `git log` on every `bearing next`: tens of milliseconds on
  the most frequent command in the tool, to render a number that says what the count already says. Cut from
  `DESIGN.md`.
- **`git mv` for moves and retitles** turned out to buy nothing. Git infers renames from content similarity at
  commit time whether or not the move was staged through it, so a plain `fs.rename` produces the identical
  diff. `git mv` only stages, and staging is the operator's business.

So **bearing never spawns a subprocess and never depends on git being installed.** That is worth more than the
two features: no `Git` service to fake in tests, no `ChildProcess` dependency, no failure mode where the tool
misbehaves inside a worktree, a submodule, or a directory that is not a repository at all. Core's dependencies
are `FileSystem`, `Path`, and `Clock`, and that is the complete list.

Bearing still assumes it lives in a git repo — close-is-delete only makes sense where something remembers, and
principle 1 says git does. It just never talks to it. The tracker is committed by the same hands and in the
same commits as the work, which was always the design.

## Package layout

```
bearing/
  packages/
    core/          private   — the domain. No terminal, no bun, no strings, no git.
    cli/           @fjorn/bearing — the terminal interface. Owns effect/unstable/cli.
  skills/          shipped skills, copied into target repos by `bearing init`
  docs/
```

**One published package, `@fjorn/bearing`, exposing a `bin` named `bearing`.** Core stays `private: true` in
the workspace and is bundled into the CLI at build time.

That is a deliberate narrowing from the first draft, which had core published as a library. Publishing a
library with no external consumer is a maintenance surface bought on speculation: a version number to bump, a
public API to avoid breaking, and semver obligations to a future MCP server that does not exist. The seam below
is what makes the future interface cheap, and the seam is a code-organization property that holds whether or
not core has its own npm entry. If a second interface ever ships and wants core separately, publishing it then
is a small change; un-publishing is not.

`apps/` stays empty and should probably be deleted; there is no application here, only a library and a shell
around it.

### The seam

The rule that makes the separation real, rather than two folders that drift into one:

> **Core returns values. Only the CLI turns a value into a string.**

Nothing in core imports `Terminal`, formats output, or knows about color. `close(id)` does not print
a dry run — it returns a `ClosePlan` holding the ticket, the trail row it found, the fog patches still present,
and the list of `blocked-by` edits it would make. The CLI renders that as the dry-run text. `--json` serializes
the same value. A future MCP tool returns it directly.

This is worth being strict about because the design already depends on it in three places:

- **`--json` on every read** is a promise from `DESIGN.md`. It is nearly free if rendering is the last step and
  a permanent tax if it is not — the failure mode is a second code path that formats JSON separately and
  gradually disagrees with the human output.
- **Dry-run and `--confirm`** are already `plan` and `apply` as separate core operations. The CLI's rule is
  that bare `close` runs `plan`, and `--confirm` runs `plan` then `apply`. An MCP interface would likely expose
  them as two tools and get the same safety property for free. That the split falls out this cleanly is decent
  evidence the seam is in the right place.
- **Testing.** Core against an in-memory `FileSystem` needs no tmpdirs and no subprocesses, which is what keeps
  a 30s test timeout irrelevant.

Core depends on the `FileSystem`, `Path`, and `Clock` services and nothing else. The Bun implementations are
supplied by the CLI at its entry point.

### What lives in core

Roughly in dependency order, and this is also a plausible build order:

1. **Ids and slugs** — nanoid generation over `[0-9a-z]`, slugification, filename parse and format, prefix
   resolution against the live set with ambiguity as an error.
2. **The store** — read `.scratch/` into memory: backlog items, tickets with parsed frontmatter, maps.
   One pass, everything downstream is pure over the result.
3. **Map parsing** — headings under `## Not yet specified` for fog anchors, the Trail table. Read-only,
   forever: bearing never writes a map.
4. **The graph** — `blocked-by` resolution, transitive gate counts, `clears` matching against fog anchors.
5. **The frontier** — BUILD/DECIDE/TRIAGE derivation and ranking.
6. **Mutations** — create, retitle (rename), triage, close, all as `plan`/`apply` pairs.
7. **Check** — the integrity pass, which is mostly assertions over the graph plus the command string that
   fixes each finding.

Only 6 touches the disk destructively, and only it needs care about atomicity.

## Skills

Top-level `skills/`, shipped in the package tarball via `files`, copied out by `bearing init`. Three things to
get right:

**Do not clobber.** Users edit installed skills. Re-running `init` to update has to detect local modification
and either skip or write alongside. This is one of the boring problems
[vercel-labs/skills](https://github.com/vercel-labs/skills) has already solved, along with detecting whether a
repo uses `.agents/` or `.claude/`; worth reading `skills add` before writing our own.

**Version the skill with the CLI.** The skill teaches the command surface, so a stale skill teaches a surface
that no longer exists. It ships in the same package at the same version, and `init --force` updates it.

**CI must grep the skill for `--confirm`.** `DESIGN.md` makes the undocumented dry run a real mechanism, and it
survives only as long as nothing shipped mentions the flag. That is exactly the kind of constraint that rots in
six months when someone helpfully documents it. A three-line test over `skills/` and the generated help output
keeps it honest, and the test's failure message should explain why rather than just asserting.

## Publishing

First time publishing, so the mechanics below are a research plan; the naming and distribution are decided.

**`@fjorn/bearing`, with a `bin` named `bearing`.** The bare name `bearing` is taken by an active package (last
published 2026-08-08), but that matters less than it looks: **the `bin` name is independent of the package
name**, so the command is `bearing` regardless of what the tarball is called. A personal scope is the better
answer anyway — one namespace for all your tools, no per-project name hunt, and no competing with whoever holds
a common English word. `@fjorn/bearing` is unregistered. Claim the scope first; npm scopes are tied to the
username, so this is free if `fjorn` is yours.

**Bun only, no node fallback.** Ship one bundled JS entry point and require bun. The fallback would have cost a
second build target, a second set of platform assumptions to test, and the standing temptation to reach for a
node-compatible API in core — permanent complexity to serve users who do not exist yet. Bearing is a personal
tool that happens to be public; someone without bun can install bun. If that changes, the measurements say a
node bundle lands around 58ms, so the door is open and cheap to walk through later.

State it in `engines` and fail loudly rather than mysteriously if something execs the bin under node.

**Release mechanics.** Only one package publishes, which simplifies this — Changesets is probably still worth
it for the changelog discipline, but a single-package repo can also get by with `npm version` and a tag. Publish
from GitHub Actions with npm provenance via OIDC, which is the current expectation for a new package and keeps
long-lived tokens off your laptop.

**Update broadcasting**, which you flagged and which is the genuinely interesting one. The reflex is an
`update-notifier`-style check on startup. That is precisely wrong here: it adds a network call to a command
budgeted at 50ms and invoked on every agent turn, and the failure modes (offline, slow DNS, corporate proxy)
land on the hot path. Better options, roughly in order:

- **Check nowhere on the hot path.** `bearing check` and `bearing init` are run deliberately and infrequently;
  a version check there costs nothing anyone notices.
- **If a passive notice is wanted**, cache the result to a state file with a TTL of a day and refresh it in a
  detached process, never blocking. Read the cache; never fetch inline.
- **Consider that agents are the primary caller** and will not act on a "new version available" banner — worse,
  unexpected banner text is noise in a transcript an agent is parsing. Any notice should be suppressed under
  `--json` and probably when stdout is not a TTY.

## Settled

All four decisions from the first pass of this document are closed, and three of them closed by subtraction:

| Question            | Decision                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Git on the hot path | **No git at all.** Age display cut; `fs.rename` for moves. No subprocesses.   |
| Node fallback       | **Bun only.** One target. Node bundle stays possible and unbuilt.             |
| Publish core?       | **No.** Private workspace package, bundled into the CLI.                      |
| Rename vs `git mv`  | **`fs.rename`.** Git infers the rename anyway; staging is the operator's job. |

The shape they add up to is worth naming, because it should hold as a bias for the next round of decisions:
every one of them made bearing smaller. What is left is a single published package, with three service
dependencies, no subprocesses, one runtime, one build target, and one interface — for a tool whose entire job
is to hold a few dozen Markdown files in a directory and answer questions about them.

## Where this stops

This document is the outline, not the plan. The next round is the first vertical slice, and the natural one is
the read path end to end: ids, the store, map parsing, and `bearing ls` — enough to point at a real `.scratch/`
and get output, with the seam exercised (core returns values, CLI renders, `--json` free) before there is
anything to unpick. `bearing next` follows once the graph and ranking exist, and mutations last, since they are
the only part that can damage a tracker.
