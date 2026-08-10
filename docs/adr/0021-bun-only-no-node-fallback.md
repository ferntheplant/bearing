# Bun only, no node fallback

Bearing ships one bundled entry point and requires Bun. There is no node build target.

The fallback would have cost a second build target, a second set of platform assumptions to test, and the
standing temptation to reach for a node-compatible API in the domain package — permanent complexity to serve
users who do not exist yet. Bearing is a personal tool that happens to be public; someone without Bun can
install Bun. The runtime requirement is stated in package metadata and fails loudly rather than mysteriously if
something executes the binary under node.

The measurements say a node bundle lands around 58ms against Bun's 22ms net. The gap is real but second-order,
and it is not where the win is — see [Gotchas: startup](../gotchas.md#startup).

## Consequences

Startup remains a product concern because bearing is invoked on every agent turn, but it is not a numeric release
gate. If the bundled Bun implementation becomes materially slow on real trackers, profile that implementation
and reconsider the runtime rather than carrying a speculative fallback meanwhile.

Subprocesses remain ruled out independently; see
[Bearing never spawns a subprocess (ADR 0018)](./0018-bearing-never-spawns-a-subprocess.md).
