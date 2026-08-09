# `.bearing/` is fixed and discovered upward

The tracker lives in `.bearing/`; its location is not configurable. A tracker command starts at the current
directory and walks upward, using the nearest `.bearing/` it finds. If none exists it fails. If the nearest one
does not have a tracker structure bearing can parse, it reports that failure and stops rather than skipping to a
farther ancestor.

This replaces [`.bearing/` is the default tracker directory (ADR 0026)](./0026-dot-bearing-is-the-default-tracker-directory.md).
A configurable default bought flexibility for a case the MVP does not have while creating a configuration file,
a command to manage it, and a root-discovery problem. The fixed tool-named directory is recognizable, works
without git, and lets nested invocations find their tracker with one deterministic rule.

## Consequences

`bearing init` creates `.bearing/` in the directory where it runs and never adopts or overwrites an unrelated
directory at that path. A malformed or colliding `.bearing/` is an error for every tracker command and for
re-running setup, not a reason to search past it or guess what the user intended.
