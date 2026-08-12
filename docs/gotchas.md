# Gotchas

Most of what is here was not chosen — the registry, the runtime, or the toolchain chose it for us, which is why
none of it is an [ADR](./adr/). The rest is a constraint that looks like clutter, standing because deleting it
silently removes a property something else depends on. [`docs/README.md`](./README.md) has the format.

**Nothing here is production battle damage yet.** These are registry, toolchain, and measurement findings taken
on 2026-08-09 (macOS/arm64, bun 1.3.14, node 22.23.1) and 2026-08-11. Re-measure before treating a number as
current, and delete an entry outright once its upstream reason stops being true.

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

## The CLI framework

**`Command.runWith` requires all five `Environment` services even when three are never used.** Its returned
effect is typed against `FileSystem | Path | Terminal | ChildProcessSpawner | Stdio`, so `Effect.runPromise`
will not type-check until every one of them is provided — including the spawner and terminal bearing must never
touch. Bearing provides die-on-use implementations for the three it does not need, so any future code path that
tries to read a terminal or spawn a subprocess dies on arrival instead of silently working
([Bearing never spawns a subprocess (ADR 0018)](./adr/0018-bearing-never-spawns-a-subprocess.md)). Casting the
effect to satisfy `runPromise` without providing them is the tidying that reintroduces this, and it does so as a
subprocess that exists because a type was force-widened.

**A handler failure is not a `CliError`, so the framework does not render it.** `runWith` catches and renders
`CliError.ShowHelp` (unknown command, unknown flag, missing argument) itself — help to stdout, errors to stderr
— and then fails the effect. A handler error like `TrackerNotFoundError` propagates unrendered, and the CLI must
render `error: <message>` itself and map the exit status. Wrapping handler errors in `CliError.UserError` to
"let the framework format them" is the tidying that reintroduces this, and it does so as `\nERROR\n` formatting
that no test asserted, the day the first mutation lands.

**`Effect.tryPromise`'s one-argument form hides the original error.** It wraps any rejection in a
`Cause.UnknownError` whose message is "An error occurred in Effect.tryPromise", so a handler that fails with a
domain error loses its `.message` entirely. The `{ try, catch: (error) => error }` object form preserves the
original error as the failure. Trusting the single-argument form because setup "just returns a promise" is the
tidying that reintroduces this, and it shows up as a stderr line naming the wrapper rather than the failure.

**The exit status is mapped by the caller, and the framework never sets one.** `Command.runWith` returns an
effect; `Effect.exit` + `Cause.squash` turns its failure into the error value, and the CLI maps success to 0,
`CliError.ShowHelp` (the framework already rendered it) to 0 when its error list is empty and 1 otherwise, and
every handler error to 1.
[Exit status is binary (ADR 0035)](./adr/0035-exit-status-is-binary.md) fixes that mapping at zero or one.
`Cause.squash` returns `unknown` and prefers the first typed failure, falling back to the defect value, so the
squashed value is not reliably `instanceof Error` for the handler path — the `error: <message>` rendering has to
handle both. Reading the exit status from `process.exitCode` set by the framework is the tidying that
reintroduces this; the framework sets no exit code, so a command that "exits 0" in the tests and 1 in a
subprocess is a mapping bug, not a framework bug.

**A command carries both a handler and subcommands, and the root handler is the default command.** Bare
`bearing` runs the root command's own handler; `bearing init` dispatches to a subcommand. So the default command
is not a subcommand you add later — it is the root handler, declared up front with `Command.make("bearing",
config, handler)` and then `.pipe(Command.withSubcommands([...]))`. Giving the root a handler and then also
adding an explicit default subcommand, or adding the first subcommand without realising the root handler already
answers bare invocation, is the tidying that reintroduces a second default command. Bearing's root handler exists
and does one thing: it fails with `CliError.ShowHelp`, which `Command.runWith` catches and renders as help
([A bare invocation prints help (ADR 0044)](./adr/0044-a-bare-invocation-prints-help.md)). Deleting the handler
because "it does nothing" does not print help — it fails to typecheck, because the root of a command tree needs
one.

**The framework's `CliConfig` ships built-in `--help`, `--version`, `--wizard`, and `--completions` flags.**
Bearing enables only `--help` and has its own `completion` ticket; the wizard flag is interactive and therefore
prohibited by [Effect's unstable CLI, pinned exactly and confined (ADR 0022)](./adr/0022-effects-unstable-cli-pinned-exactly-and-confined.md).
`CliConfig.layer({ builtIns: [GlobalFlag.Help] })` pins the surface. Accepting the default built-ins because
"they're just flags" is the tidying that reintroduces an interactive prompt via a flag nothing in this
repository chose.

**`--json` is a global flag, and a global flag reaches its handler through the Effect context, not the config
object.** It is built with `GlobalFlag.setting("json")({ flag: Flag.boolean("json") })`, attached once with
`Command.withGlobalFlags([JsonOutput])` on the root, and read inside a handler as `yield* JsonOutput` — it never
appears in that command's config record. `CliConfig.layer({ builtIns: [...] })` is _not_ the way to register one:
its `builtIns` is typed to the framework's own five built-ins and rejects a custom flag. Re-declaring `--json` in
a command's config so it "shows up like the other flags", or reaching for a hand-rolled `args.includes("--json")`
inside the handler, is the tidying that reintroduces a second argument parser alongside the one the framework
runs.

**The framework prints a choice's accepted values in flag help but not in argument help.** `appendChoiceKeys`
runs in `toFlagDoc` and has no counterpart for arguments, so `Argument.choice("type", ["build", "design"])`
renders as a bare `type choice` with no hint of what it accepts. Bearing writes the values into the argument's
own description instead, which is why `bearing add --help` says `build | design` in prose. Deleting that as
redundant — the framework surely shows the choices — is the tidying that puts the enum back out of reach.

## Startup

Bearing is invoked on every agent turn, so these numbers informed the runtime choice in
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

**`npm` cannot run anywhere in this workspace, and that is the guard working.** The root
`devEngines.packageManager` pins bun, so every npm command — `npm pack`, `npm whoami`, even
`npm config get registry` — exits `EBADDEVENGINES` without doing anything. Verified 2026-08-10 on npm 10.9.8:
the same package packs normally under npm from a directory outside the workspace root, so the failure belongs to
the workspace rather than to the package. It is what stops a stray `npm install` from resolving a tree the bun
lockfile does not describe, under [Bun only, no node fallback (ADR 0021)](./adr/0021-bun-only-no-node-fallback.md).
Relaxing `devEngines` because some command needs npm is the tidying that reintroduces this — and the command
that will eventually need it is `npm publish`, since `bun publish` implements no OIDC, so it has to run against a
staged directory outside the workspace anyway.

**A version check on startup is a network call on the hot path.** The reflex for a published CLI is an
update-notifier at boot; here it adds DNS, offline, slow-proxy, and registry failure modes to a command invoked on
every agent turn. The MVP emits no update notice from setup, the integrity pass, or ordinary commands. If that
decision changes, reaching for an inline notifier rather than an explicitly designed mechanism is the tidying
that reintroduces the hot-path network call. Agents are the primary caller and will not act on a banner;
unexpected banner text is noise in a transcript something may be parsing.

## Constraints that look like clutter

**The lint rule prohibiting the prompt module is what makes agent-operability mechanical.** Without it, "no
interactive prompts" is a sentence in a document that the next convenient prompt quietly violates, and the
failure is invisible until an agent hangs waiting on stdin. It is one entry in the restricted-imports rule the
repo already configures. Deleting it as redundant with the convention is the tidying that reintroduces this.

**CI greps the shipped skill and the generated help output for the confirmation flag.** The design-close dry run
in [The confirmation flag is undocumented on purpose (ADR 0016)](./adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
survives only as long as nothing shipped mentions the flag — and it is exactly the kind of constraint that rots
in six months when someone helpfully documents it. The test's failure message has to explain why rather than
just asserting, or the next person will "fix" the test.
