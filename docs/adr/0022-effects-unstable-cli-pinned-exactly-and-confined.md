# Effect's unstable CLI, pinned exactly and confined

Bearing is built on the Effect 4 beta line, and its command surface uses the CLI modules that live inside Effect
core under `unstable/`. The separately published CLI package is a v3-era artifact and is deliberately not a
dependency — adding it would silently pull a second major version of Effect into the tree. See
[Gotchas: the toolchain](../gotchas.md#the-toolchain) for the registry findings behind that.

`unstable/` plus a beta dist-tag means the API will break between releases; that is what both labels are for.
Two mitigations, and they are cheap enough that the risk is worth taking for a framework that is otherwise the
right fit:

- **Pin exactly.** Never a range on a beta, in a catalog the whole workspace resolves through.
- **Confine the blast radius.** Every import of those modules lives in one package. That is not a constraint
  invented for the beta — it is the seam in
  [Core returns values; only the CLI renders (ADR 0019)](./0019-core-returns-values-only-the-cli-renders.md),
  which we want anyway. The beta just raises its value: an API break becomes a diff in one directory instead of
  a migration.

## Consequences

The framework's prompt module is exactly what first-time setup needs, which makes the no-interactive-prompts
rule mechanically enforceable rather than aspirational: **the prompt module may be imported by the setup command
and nowhere else**, as a lint rule on restricted imports. See
[Only design-ticket closing is a dry run (ADR 0029)](./0029-only-design-ticket-closing-is-a-dry-run.md).

Shell completion generation comes with the framework, so that command is close to a one-liner rather than a
feature.
