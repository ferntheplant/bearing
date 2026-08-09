# Gotchas

Most of what is here was not chosen — the registry, the runtime, or the toolchain chose it for us, which is why
none of it is an [ADR](./adr/). The rest is a constraint that looks like clutter, standing because deleting it
silently removes a property something else depends on. [`docs/README.md`](./README.md) has the format.

**Nothing here is production battle damage yet.** These are registry, toolchain, and measurement findings taken
on 2026-08-09 (macOS/arm64, bun 1.3.14, node 22.23.1). Re-measure before treating a number as current, and delete
an entry outright once its upstream reason stops being true.

## The toolchain

**The separately published Effect CLI package is a v3-era artifact and must not be added.** Its latest release
is `0.77.0` and there is no v4 line; adding it pulls a second major version of Effect into the tree, silently
and at install time rather than at a type error. In v4 the CLI moved into core under `effect/unstable/cli`,
exporting `Command`, `Flag`, `Argument`, `Param`, `Primitive`, `GlobalFlag`, `HelpDoc`, `CliConfig`,
`CliOutput`, `CliError`, `Completions`, and `Prompt`. Reaching for the package because the module path has
`unstable` in it is the tidying that reintroduces this.

**`Terminal`, `FileSystem`, and `Path` are top-level core modules**, not platform-package modules —
`effect/Terminal`, `effect/FileSystem`, `effect/Path` — with Bun implementations in `@effect/platform-bun` as
`BunTerminal`, `BunFileSystem`, `BunPath`, alongside `BunRuntime`. The platform package also carries a
child-process spawner and there is an `effect/unstable/process` module; bearing needs neither, and
[Bearing never spawns a subprocess (ADR 0018)](./adr/0018-bearing-never-spawns-a-subprocess.md) is why that
matters more than it looks.

**Bun's `Glob` skips dotfiles by default, and the tracker lives in a dotted directory.** `new
Glob(".bearing/tickets/*.md").scan(".")` yields nothing at all — not an error, not a warning, an empty
iteration — because `dot` defaults to `false` and every path component counts. `scan({ cwd: ".bearing/tickets",
dot: true })` is the working form. Verified on bun 1.3.14 while checking this repo's own tracker by hand, which
is how it was found: the check reported zero tickets and looked like it had passed. Writing the obvious glob and
trusting an empty result is the tidying that reintroduces this, and it reintroduces it as a read path that
silently believes the tracker is empty.

**There is no standard for turning a Markdown heading into an anchor, and GitHub's is the one that matters.**
CommonMark specifies no anchors at all; GitHub, GitLab, and VS Code's preview each grew their own, disagreeing
on non-ASCII, on which punctuation survives, and on how duplicates are suffixed. Bearing stores fog links as
anchor slugs
([Four frontmatter fields (ADR 0024)](./adr/0024-four-frontmatter-fields-and-the-body-is-prose.md)), so the
algorithm is part of the on-disk format rather than an implementation detail: lowercase, drop everything but
word characters, spaces, and hyphens, then spaces to hyphens — GitHub's, because a map is read in a browser.
Writing a "simpler" regex is the tidying that reintroduces this, and it fails silently in the worst direction —
a link that resolves in the editor and 404s for the reader. **Two patches on one map whose headings slugify
identically are undefined behaviour**, deliberately: GitHub would suffix the second one `-1`, bearing attaches
every ticket to the first, and nothing warns. Detecting it would mean extending an error set that
[the integrity pass](./capabilities/07-integrity.md) keeps deliberately closed, to cover a collision that a
human staring at two identical headings would see first.

**Vitest runs as `bunx --bun vp test`, never from `node_modules/vitest`.** Vite+ executes the same Vitest copy
that `vite-plus/test` re-exports, while the obvious hoisted binary is a separate module instance. Launching that
binary (`bun node_modules/vitest/vitest.mjs run`) makes every suite die with `runner.config is undefined`.
The `--bun` flag also keeps the runner on bearing's target runtime, which the CLI tests need for Bun's platform
services. Reaching for the hoisted binary or dropping `--bun` is the tidying that reintroduces this.

**`sortPackageJson` normalizes an `exports` map back to a plain string, silently dropping a `types` condition.**
The repo's formatter rewrites `".": { "types": "./src/index.ts", "default": "./dist/index.mjs" }` to
`".": "./dist/index.mjs"`, so a package that must type-resolve to source before its first build —
`@bearing/core` on a clean checkout — cannot say so in `package.json`. The resolution lives in the importing
workspace's tsconfig instead: a `paths` entry pointing at the source `index.ts`, which formatting leaves alone.
Adding the condition and trusting it to survive `vp check --fix` is the tidying that reintroduces this.

**`unstable/` and a `beta` dist-tag are two separate warnings, and both are accurate.** The beta line was at
`4.0.0-beta.106` while the `latest` tag still pointed at 3.22.1, so a dependency resolved by tag gets a
different major version than the one the code is written against. Every Effect dependency is pinned exactly in
the workspace catalog. Widening one to a caret range because "it's all the same beta line" is the tidying that
reintroduces this, and it fails at the next publish rather than at the next install.

## Startup

Bearing is invoked on every agent turn, so these numbers are the reason for the budget in
[Bun only, no node fallback (ADR 0021)](./adr/0021-bun-only-no-node-fallback.md). Fifteen runs each, `--minify`
where bundled, against a measured shell-harness floor of 14ms:

| Setup                                  | Wall     | Net over floor |
| -------------------------------------- | -------- | -------------- |
| `bun bare.ts` (a single `console.log`) | 31ms     | 17ms           |
| `node --experimental-strip-types`      | 72ms     | 58ms           |
| `bun` + the Effect CLI, unbundled      | 77ms     | 63ms           |
| **`bun` + the same, bundled (87K)**    | **36ms** | **22ms**       |
| `bun build --compile` binary (61MB)    | 88ms     | 74ms           |

**Bundling matters more than the runtime, and the framework is not the cost.** Unbundled, Effect costs 46ms of
module resolution over bare Bun. Bundled, it costs 5ms. Effect is not slow to start; resolving several hundred
small files is. Skipping the build step for a "simple" entry point — a smoke script, a local run — is the
tidying that reintroduces this, and it does so as a number nobody attributes to module resolution.

**The standalone compiled binary is the trap.** It is the option that sounds fastest — no runtime dependency,
one artifact — and it measured as the slowest thing here, 3× the bundled script while being 61MB against 87K.
Loading a 61MB executable is not free, and on macOS there is likely per-exec signature checking on top. It also
multiplies the release matrix by every platform. Worth re-measuring on Linux before treating the conclusion as
portable, but on this evidence there is no case for it.

## Packaging and publishing

**`git mv` buys nothing over a plain rename.** Git infers renames from content similarity at commit time whether
or not the move was staged through it, so both produce an identical diff. `git mv` only stages, and staging is
the operator's business. Reaching for it to "keep history" is the tidying that reintroduces a subprocess
dependency for no gain.

**The binary name is independent of the package name.** The bare registry name `bearing` is held by an active
package (last published 2026-08-08), which does not constrain the command at all — a scoped package can expose
an unscoped `bin`. Renaming the command to match a scope, or hunting for an available bare name, are both
solving a problem that does not exist.

**A version check on startup is a network call on the hot path.** The reflex for a published CLI is an
update-notifier at boot; here it lands a DNS lookup inside a command budgeted at 50ms and invoked on every agent
turn, with offline, slow-DNS, and corporate-proxy failure modes all landing on the same path. Version checks
belong in the commands that are run deliberately and infrequently — the integrity pass and setup. If a passive
notice is ever wanted, it reads a cached file with a day-long TTL and refreshes it detached, never inline. Worth
remembering that **agents are the primary caller and will not act on a banner**; unexpected banner text is noise
in a transcript something is parsing, so any notice is suppressed under JSON output and when stdout is not a
TTY.

## Constraints that look like clutter

**The lint rule restricting the prompt module to the setup command is what makes agent-operability
mechanical.** Without it, "no interactive prompts anywhere but setup" is a sentence in a document that the next
convenient prompt quietly violates, and the failure is invisible until an agent hangs waiting on stdin. It is
one entry in the restricted-imports rule the repo already configures. Deleting it as redundant with the
convention is the tidying that reintroduces this.

**CI greps the shipped skill and the generated help output for the confirmation flag.** The undocumented dry run
in [The confirmation flag is undocumented on purpose (ADR 0016)](./adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
survives only as long as nothing shipped mentions the flag — and it is exactly the kind of constraint that rots
in six months when someone helpfully documents it. The test's failure message has to explain why rather than
just asserting, or the next person will "fix" the test.
