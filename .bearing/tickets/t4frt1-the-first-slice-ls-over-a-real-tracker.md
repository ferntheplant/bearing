---
type: build
project: mvp
---

# The first slice: ls over a real tracker

## Background

`ABSTRACT.md` §7 puts the read path first, end to end, so the seam is exercised before there is anything to
unpick. The module ordering inside core stays fog deliberately — the patch says the seams are decidable only
against real code, so this ticket is what makes that patch answerable rather than what answers it. Nothing here
should be treated as settling where core's internal seams go; that graduates afterwards.

Both workspaces get scaffolded now. `apps/cli` holds the interface and is the package that publishes
([One published package (ADR 0020)](../../docs/adr/0020-one-published-package-and-core-stays-private.md));
`packages/core` holds the domain and stays private. The entrypoint stays deliberately thin — no
`effect/unstable/cli`, no framework, no command parsing — because the point of this slice is the seam, not the
surface. It is still a real entrypoint in the real package: a rendering shim inside `packages/core` would break
[Core returns values (ADR 0019)](../../docs/adr/0019-core-returns-values-only-the-cli-renders.md) in the first
commit, and `console.log` is a lint error repo-wide anyway.

The on-disk format it parses is
[Four frontmatter fields (ADR 0024)](../../docs/adr/0024-four-frontmatter-fields-and-the-body-is-prose.md).

## Scope

In:

- `packages/core` — read `<tracker>/tickets/`, parse each filename into an id and a slug, parse frontmatter into
  `type`, `project`, `blockers`, `clears`, with an absent list meaning empty. Return values; no strings.
- `apps/cli` — one entrypoint file that invokes core and writes to stdout, plus `--json` emitting the same
  values it rendered.
- Whatever id and slug handling the above needs, no more.

Out:

- **Map parsing.** Nothing reads `maps/`. `--project` is not implemented; validating that a project exists is
  the integrity pass's job and it does not exist yet.
- **The backlog.** `ls` lists tickets. Bare `bearing backlog` is its own command.
- Every other command, all filters, ranking, the frontier, and every mutation.
- Deciding core's module seams — see Background.

## Done when

- `apps/cli` and `packages/core` exist as workspaces, and `apps/` is in the root `package.json` workspaces and
  `tsconfig.json` include.
- Running the `apps/cli` entrypoint against this repository's own tracker prints the five tickets, each with its
  id, title, type, project, and — where present — its blockers and the fog it clears.
- The same invocation with `--json` emits the same values as JSON, and the JSON round-trips the fields rather
  than the rendered text.
- A ticket with no `blockers` and no `clears` reads as empty lists rather than failing, and a design ticket with
  no `project` parses rather than throwing — the integrity pass, not the parser, is what objects to it.
- Nothing in `packages/core` imports a terminal, formats output, or writes to a stream.
- `vp check` and `vp test` pass from a clean checkout, with no lint suppressions added.
