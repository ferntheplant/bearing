# Installation is a linked clone, and publishing is deferred

Bearing is installed by cloning this repository, building it, and running `bun link` in `apps/cli`, which puts a
`bearing` binary on `PATH`. Nothing is published to a registry and there is no release workflow.
`@ferntheplant/bearing` is the name reserved for the day there is one — a personal scope, which is what
[One published package, and core stays private (ADR 0020)](./0020-one-published-package-and-core-stays-private.md)
argued for; the bare name remains taken and remains irrelevant, since the binary name is independent of it.

Publishing buys nothing the MVP is measured on: bearing has one user, and none of the 27 criteria in
[`ABSTRACT.md`](../../ABSTRACT.md) §8 mention distribution. It is not free either, and the cost is concentrated
in one place — **the first release is the expensive one, and it cannot be automated.** `npm trust` requires the
package to already exist on the registry, so trusted publishing cannot mint a package's initial version;
[npm/cli#8544](https://github.com/npm/cli/issues/8544) is the open request to change that. The first publish is
therefore a human with a long-lived credential, which is the exact thing the provenance story exists to avoid.
Underneath that, `bun publish` does not implement OIDC ([oven-sh/bun#22423](https://github.com/oven-sh/bun/issues/22423)),
so the publishing step has to be `npm publish` — a command this workspace forbids, for reasons that are
themselves deliberate. Deferring costs a promise nobody is currently owed.

## Considered options

**A Homebrew formula carrying a standalone binary** would remove Bun from the installation entirely. It is
refused on evidence already taken: the `bun build --compile` binary measured 61MB and 3× slower to start than
the bundled script ([Gotchas: startup](../gotchas.md#startup)), and it would multiply a release matrix that does
not exist yet by every platform. [Bun only, no node fallback (ADR 0021)](./0021-bun-only-no-node-fallback.md)
already answered the runtime question: someone without Bun can install Bun.

**A project devDependency**, pinning the CLI next to the skill it installed, was refused because it would
require every adopting repository to have a `package.json`. Nothing says the repository bearing lands in is a
JavaScript project — §8 criterion 26 says the opposite, that commands work outside a git repository at all — and
[Bearing stops at the repo's edge (ADR 0014)](./0014-bearing-stops-at-the-repos-edge.md) is why bearing does not
reach into the target's manifest to install itself.

## Consequences

The checkout is the installation. A linked binary resolves `effect` and `@effect/platform-bun` from the
workspace's own `node_modules`, so moving or deleting the clone breaks the command, and `vp run -r build` after
a pull is what updates it. Bun is required to install, not merely to run.

**Version numbers are meaningless until this is reversed.** Every installed skill records the workspace version
in its ownership marker, which is `0.0.0` and stays there. That is harmless only because
[One owned skill installation, updated only while untouched (ADR 0036)](./0036-one-owned-skill-installation-updated-only-while-untouched.md)
decides freshness by digest rather than by version — a version-comparing update check would silently never fire.

Reversing this is packaging work, then one human publish, then an OIDC configuration — in that order, and none
of it blocked on a question. What the tarball is currently missing is written down as a backlog item rather than
carried here.
