# Make the tarball publishable

Nothing publishes today
([Installation is a linked clone, and publishing is deferred (ADR 0038)](../../docs/adr/0038-installation-is-a-linked-clone-and-publishing-is-deferred.md)),
so none of this blocks anything. It is written down because it was all measured at once, on 2026-08-10, from
`bun pm pack` in `apps/cli` — 15 files, 154kB packed, 717kB unpacked — and re-deriving it later means repeating
the pack.

**The tarball declares a dependency that can never resolve.** Bun rewrites `workspace:*` at pack time, so
`@bearing/core` lands in the published manifest as `"@bearing/core": "0.0.0"` — a package that is private and
by ADR 0020 will never exist on the registry. Every `install` would fail. The bundle itself is correct:
`dist/cli.mjs` externalises only `effect`, `@effect/platform-bun`, and `node:module`, with core and `yaml`
inlined, so core belongs nowhere in `dependencies`. The catalog entries resolve correctly to exact pins, which
is the behaviour wanted.

**There is no `files` field, so `src/`, `test/`, `tsconfig.json`, `vite.config.ts`, and
`scripts/packaged-skill-plugin.ts` all ship.** The `imports` map ships with them and points `#src/*` at source
that should not be in the tarball at all.

**`dist/cli.mjs.map` is 450kB of a 717kB tarball** — 63% sourcemap for a binary whose stack traces nobody
off this machine will read.

Missing metadata, each of which has a consumer: no `publishConfig.access: "public"` (a scoped package publishes
restricted by default), no `repository` (which npm matches against the trusted-publisher configuration, and
mismatches reject the publish), no `license` despite `LICENSE` sitting in the root, no `description`, and no
`engines` — that last one contradicts
[Bun only, no node fallback (ADR 0021)](../../docs/adr/0021-bun-only-no-node-fallback.md), which claims the
runtime requirement is stated in package metadata. It is not.

Separately, `apps/cli/src/version.ts` is dead code. `BEARING_VERSION` reaches no caller, appears nowhere in the
built bundle, and there is no `--version` flag; the `#package.json` subpath import it depends on has never been
exercised at runtime.

Nobody has committed to any of it, and the size is a judgement about how much is worth doing before there is a
release to do it for.
