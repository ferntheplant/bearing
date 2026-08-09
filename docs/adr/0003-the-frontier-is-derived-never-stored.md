# The frontier is derived, never stored

No file in the tracker says what the next work is. Readiness, ordering, blocked-ness, fog counts, and the whole
frontier are computed on every run from what is on disk.

Storing any of it would create a second copy that the first missed update leaves permanently wrong — the classic
failure of a status column, and the reason maps do not list their own open tickets. The cost is recomputation on
every invocation, which is affordable because the tracker is bounded by what a person can hold in their head: a
few dozen small Markdown files.

## Consequences

Every derived view has exactly one input, the files themselves, so there is no reconciliation step, no rebuild
command, and no way for the tracker to be internally out of date.

It also sets the performance requirement: the frontier is recomputed on the most frequently run command in the
tool, which is why nothing on that path is allowed to be expensive — see
[Bearing never spawns a subprocess (ADR 0018)](./0018-bearing-never-spawns-a-subprocess.md).
