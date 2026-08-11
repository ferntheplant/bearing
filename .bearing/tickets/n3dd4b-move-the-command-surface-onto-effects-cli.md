---
type: build
project: mvp
---

# Move the command surface onto Effect's CLI

## Background

`apps/cli/src/cli.ts` reads `process.argv` by hand and understands two invocations: bare `bearing` with an
optional `--json`, and `bearing init`. The [capability catalogue](../../docs/capabilities/) promises about a
dozen commands between them, each with its own flags, and every read among them takes `--json`.

[Effect's unstable CLI, pinned exactly and confined (ADR 0022)](../../docs/adr/0022-effects-unstable-cli-pinned-exactly-and-confined.md)
already fixes what parses them and where that import may live, and
[the toolchain gotchas](../../docs/gotchas.md) record why the separately published Effect CLI package must not be
added instead. Nothing has used `effect/unstable/cli` yet, so the decision is recorded and unexercised.

This goes first because every other command ticket on this map adds a subcommand. Written against the hand-rolled
parser they would all be rewritten later; written against the framework the second one is nearly free.

## Scope

Replace the argv handling in `apps/cli` with `Command`, `Flag`, and `Argument` from `effect/unstable/cli`,
keeping bare `bearing` and `bearing init` behaving exactly as they do now. Establish the shape the remaining
command tickets reuse: the default command, `--json` as a flag a read command declares, generated help, and the
binary exit status of [Exit status is binary (ADR 0035)](../../docs/adr/0035-exit-status-is-binary.md).

Out of scope: every new command, `bearing completion`, and colour. Nothing here changes `packages/core`.

## Done when

- Bare `bearing`, `bearing --json`, and `bearing init` produce the same stdout and exit status as before, and
  the existing `apps/cli/test` assertions still cover them.
- An unknown command, an unknown flag, and a missing required argument each exit 1 with a message naming what
  was expected.
- `bearing --help` lists exactly the commands that exist.
- Every `effect/unstable/cli` import in the repository is under `apps/cli`, and `packages/core` imports none.
- No command spawns a subprocess and none reads a terminal for input.
- `vp run ready` passes from a clean checkout.
