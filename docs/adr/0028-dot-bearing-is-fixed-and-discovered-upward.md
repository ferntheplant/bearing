# `.bearing/` is fixed and discovered upward

The tracker lives in `.bearing/`; its location is not configurable. A tracker command starts at the current
directory and walks upward, using the nearest `.bearing/` it finds. If none exists it fails. If the nearest one
does not have a tracker structure bearing can parse, it reports that failure and stops rather than skipping to a
farther ancestor. The `.bearing/` entry must be a physical directory rather than a symbolic link; any symlink at
that path is a collision, whether or not its target exists or contains a valid tracker.

A configurable path was the first answer, and it bought flexibility for a case the MVP does not have while
creating a configuration file, a command to manage it, and a root-discovery problem. The fixed tool-named
directory is recognizable, works without git, and lets nested invocations find their tracker with one
deterministic rule.

## Considered options

`tracker/` and other generic root names were rejected for claiming a name the repository may want for itself,
and the ancestor's `.scratch/` for being collision-prone. Naming the directory after the tool is what makes it
recognizable on sight; keeping it hidden is the smaller cost, since the tracker is reached through bearing,
through the repository's own documentation, and through agent tooling rather than by browsing the root.

## Consequences

`bearing init` creates `.bearing/` in the directory where it runs and never adopts or overwrites an unrelated
directory at that path. A malformed or colliding `.bearing/` is an error for every tracker command and for
re-running setup, not a reason to search past it or guess what the user intended. In particular, bearing never
follows a `.bearing` symlink: accepting one would make the fixed location configurable through filesystem
indirection, while skipping a dangling one would violate nearest-ancestor precedence.
