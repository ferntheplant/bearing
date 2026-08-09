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
`BunPath`, plus `BunRuntime` and `BunChildProcessSpawner`. Subprocesses come from `effect/unstable/process`.

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

One thing threatens it. TRIAGE reports "oldest backlog item by git-add date," which needs `git log` — a
subprocess, tens of milliseconds, on a command that runs constantly. Options: cache it, drop the age and show
only a count, or accept the cost on `next` alone. Flagged in open decisions; my inclination is that a count is
most of the value.

## Package layout

```
bearing/
  packages/
    core/          @bearing/core   — the domain. No terminal, no bun, no strings.
    cli/           bearing-cli     — the terminal interface. Owns effect/unstable/cli.
  skills/          shipped skills, copied into target repos by `bearing init`
  docs/
```

`apps/` stays empty and should probably be deleted; there is no application here, only a library and a shell
around it.

### The seam

The rule that makes the separation real, rather than two folders that drift into one:

> **Core returns values. Only the CLI turns a value into a string.**

Nothing in `@bearing/core` imports `Terminal`, formats output, or knows about color. `close(id)` does not print
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
supplied by the CLI at its entry point. A `Git` service wraps the one or two git invocations behind an
interface so tests can fake them.

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

You have not published before, so this is the section with the most unknowns; treat it as a research plan
rather than a decision.

**The name `bearing` is taken** — an active package, last published 2026-08-08. `bearing-cli` and `@bearing/*`
are both free. This matters less than it sounds: **the `bin` name is independent of the package name**, so
`bearing-cli` still installs a command called `bearing`. Recommendation is `bearing-cli` publicly with
`@bearing/core` as the library, but confirm the `@bearing` scope is actually claimable before committing —
a 404 on `@bearing/core` proves the package does not exist, not that the scope is free.

**Distribution.** Given the measurements, ship a bundled JS entry point with a `bin`, and require bun. That is
the fast path and the small one. The cost is a hard bun dependency, which is fine for your use and a barrier
for anyone else — worth deciding whether bearing is a personal tool that happens to be public, or something
meant to be installed by people who do not have bun. If the latter, the fallback is a node-compatible bundle
(58ms floor, still acceptable) rather than compiled binaries.

**Release mechanics.** Changesets for versioning and changelog across the two packages; publish from GitHub
Actions with npm provenance via OIDC, which is the current default expectation for a new package and avoids
long-lived tokens on your laptop.

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

## Open decisions

- **Git on the hot path.** Whether TRIAGE keeps "oldest by git-add date" at the cost of a subprocess on every
  `bearing next`, caches it, or degrades to a count. Leaning count.
- **Node fallback.** Whether to ship a node-compatible bundle alongside the bun one, which decides whether
  bearing is installable by people without bun.
- **Whether `@bearing/core` is published at all.** It could stay private in the workspace and be bundled into
  `bearing-cli`, which is simpler until there is a second interface actually consuming it. Publishing a library
  nobody imports yet is a maintenance surface with no users.
- **Rename vs `git mv`.** Plain `fs.rename` is simpler and git infers renames from content anyway; `git mv`
  only stages the change. Probably plain rename, which removes git from the mutation path entirely and leaves
  it needed for nothing but the backlog-age read above — which, if that read goes, removes git from bearing
  altogether.
