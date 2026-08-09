# `.bearing/` is the default tracker directory

> Superseded by [`.bearing/` is fixed and discovered upward (ADR 0028)](./0028-dot-bearing-is-fixed-and-discovered-upward.md).

When a repository has not chosen a tracker path, `bearing init` uses `.bearing/` at its root. The path remains a
default rather than a requirement: the sole configuration key can point bearing somewhere else.

Naming the directory after the tool makes it recognizable and avoids claiming a generic root name such as
`tracker/` or reusing the ancestor's collision-prone `.scratch/`. Keeping it hidden is the smaller cost: the
tracker is reached through bearing, repository documentation, and agent tooling, while a visible generic name
would compete with the repository's own top-level structure on every adoption.
