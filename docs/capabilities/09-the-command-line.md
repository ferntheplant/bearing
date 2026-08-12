# The command line

What every bearing command does the same way, regardless of what it is for: how it is invoked, how it reports,
what it emits, and what it never does. The other capabilities say what each command means; this one says what
holds across all of them.

## What you can expect

- **A bare `bearing` prints help.** Not the frontier, not a dashboard — the list of commands, the way every other
  CLI answers being run with no arguments. `bearing next` is the frontier.
- **`--json` is a global flag.** It is parsed once for the whole command tree, like `--help`, so it goes anywhere
  on the line and every command accepts it — reads emit the value they would have rendered, and mutations emit
  what they did. There is no command with a `--json` that means something different from the others.
- **Colour when a person is looking, never otherwise.** Human output is coloured on a terminal; `NO_COLOR`
  suppresses it, a pipe or a file gets none, and `--json` is never coloured. An id carries a colour derived from
  the id itself, so the same handle looks the same in every listing that names it.
- **Every command explains itself.** `--help` on any command names its arguments and flags, says what each one is
  for, and spells out the values a choice accepts.
- **Process status is binary.** Zero means the requested operation succeeded, including a valid no-op and an
  integrity report carrying warnings but no errors; one covers every refusal, invalid invocation, integrity
  error, and operational failure. Structured diagnostics carry the distinction, not a widening set of statuses.
- **Nothing is ever prompted for.** No confirmation, no wizard, no editor, no interactive selection. A command
  that needs something it was not given fails and says what to type instead.
- **One name per command.** No aliases: `add`, `rm`, and `close` are the names, and there is no `new`, `create`,
  `done`, or `delete` to learn as a second vocabulary. The word that names the operation in
  [`CONTEXT.md`](../../CONTEXT.md) is the word the command uses.

## Where it stands

**Built.** Bare `bearing` prints help from anywhere, including a directory with no tracker. `--json` is declared
once as a global flag and read from context by every handler, including `bearing init`. Rendering runs through a
style seam with an ANSI and a plain implementation, chosen from `NO_COLOR` and whether stdout is a terminal;
tests assert against the plain style. Every argument and flag carries help text, and `bearing add` names `build |
design` itself because the framework does not. Exit status is mapped in one place at the CLI's edge.

## Decisions

- [A bare invocation prints help (ADR 0044)](../adr/0044-a-bare-invocation-prints-help.md) — why the frontier
  stopped being the default command.
- [Bearing colourises human output (ADR 0041)](../adr/0041-bearing-colourises-human-output.md) — what gets colour
  and why ids get their own.
- [Exit status is binary (ADR 0035)](../adr/0035-exit-status-is-binary.md) — why diagnostics, rather than a
  growing set of process statuses, distinguish failures.
- [Core returns values (ADR 0019)](../adr/0019-core-returns-values-only-the-cli-renders.md) — why every one of
  these is a property of the CLI and of nothing underneath it.
- [Effect's unstable CLI, pinned exactly and confined (ADR 0022)](../adr/0022-effects-unstable-cli-pinned-exactly-and-confined.md)
  — why the prompt module is prohibited rather than merely unused.
