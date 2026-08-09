# Bearing

Bearing is a file-based issue tracker and CLI for exploring a **fog of war**: work too large for one agent
session, where the route to the destination is not yet visible. Read [`ABSTRACT.md`](./ABSTRACT.md) first if you
don't know what that means.

## Where things live

| If you need                                | Read                                         |
| ------------------------------------------ | -------------------------------------------- |
| What bearing is and what "done" looks like | [`ABSTRACT.md`](./ABSTRACT.md)               |
| What bearing does for its user             | [`docs/capabilities/`](./docs/capabilities/) |
| What a word means                          | [`CONTEXT.md`](./CONTEXT.md)                 |
| Why something is the way it is             | [`docs/adr/`](./docs/adr/)                   |
| Why something that looks broken isn't      | [`docs/gotchas.md`](./docs/gotchas.md)       |
| What is still undecided                    | nothing — see the reading rule below         |
| What is planned, in progress, or untriaged | the tracker — [`.bearing/`](./.bearing/)     |
| How to write any of the above              | [`docs/README.md`](./docs/README.md)         |

New writing goes to one of those homes from the start, and **nothing lives in two of them**: a capability file
says what a user can expect and links the decision behind it rather than restating it. `ABSTRACT.md` sits above
all four and changes rarely — a claim about what the whole system is or when it is done, not a description of
one capability. [`docs/README.md`](./docs/README.md) holds the formats and is the only file about the
documentation system rather than about bearing; the
[`domain-modeling`](./.agents/skills/domain-modeling/SKILL.md) skill defers to it.

**The reading rule: if something is not written in an ADR or a capability file, it is not decided.** Silence
means open, and there is no third register to check — no parked questions, no provisional-answers appendix.
Undecidedness that blocks a destination is fog on a map in the tracker; undecidedness that blocks nothing is
simply absent. [`docs/README.md`](./docs/README.md) has the reasoning.

## The tracker

Bearing tracks bearing. `.bearing/` holds what has been committed to and not yet finalized into this repository,
and **this file is the only doorway to it** — nothing else links in. Durable prose cites the ADR, capability, or
`CONTEXT.md` entry that holds a decision, never a ticket or a map.

The live map is `.bearing/maps/mvp.md`. Its destination is bearing maintaining this directory itself: **until
the CLI exists, every structured edit here — ids, filenames, frontmatter, blocker lists, trail rows — is made by
hand, and that is the experiment.** A hand-edit that feels clerical is evidence about which criterion in
`ABSTRACT.md` §8 should remove it. Prose stays hand-written either way; that part never gets automated.

Read the map's **Notes** before working a ticket on it. They say what counts as durable here, which is what
decides when a design ticket is allowed to close.

## Vocabulary

Two glossaries are binding, and using their words exactly is the point of having them.

- **Domain language** — [`CONTEXT.md`](./CONTEXT.md). A ticket is not an issue. A project is a map. Closing is
  deleting. The trail is not a route. If you need a term that isn't there and the conversation settles it, add
  it.
- **Design language** — the [`codebase-design`](./.agents/skills/codebase-design/SKILL.md) skill. Say
  **module**, **interface**, **implementation**, **adapter**, **seam**, **depth**. Not "component", "service",
  "API" (for a module's interface), or **"boundary"** — that word is retired here.

## Architectural rules

Most of these have an ADR behind them. If a rule seems wrong, look for its ADR before working around it.

- The domain package returns values; only the CLI turns a value into a string. Nothing in the domain imports a
  terminal, formats output, or knows about colour.
- Every mutation has separate planning and applying operations. Bare commands run both; a bare design close
  runs only its plan.
- The domain depends on the filesystem, path, and clock services and nothing else. The Bun implementations are
  supplied at the CLI's entry point.
- No subprocesses, ever, and no dependency on git being installed.
- Every import of `effect/unstable/cli` lives in the CLI package. Effect versions are pinned exactly, never
  ranged.
- The prompt module may be imported by the setup command and nowhere else, enforced by lint.
- Bearing never writes a map.
- Tracker prose is edited directly; there is no edit command.
- Tracker commands discover the nearest ancestor's `.bearing/` and fail on a malformed one rather than searching
  past it. There is no configuration.
- `--json` on every read, `NO_COLOR` respected, no interactive prompts outside first-time setup.
- Nothing shipped — help text, skill, error messages — names the flag that applies a design close.

## Definition of done

A change is done when its production path is reachable through a real entrypoint; success and expected failure
are tested; the acceptance criteria in [`ABSTRACT.md`](./ABSTRACT.md) §8 are demonstrably closer to passing;
`vp run ready` passes from a clean checkout; and the documentation is updated where implementation invalidated
an assumption — a new decision means a new ADR, a new term means a `CONTEXT.md` entry, a changed promise means a
capability edit, including its **Where it stands**.

All commits follow Conventional Commits.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
