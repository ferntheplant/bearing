# Bearing never spawns a subprocess

Bearing does not shell out to git, or to anything else. It has no process-execution dependency at all. Its
service dependencies are a filesystem, a path implementation, and a clock, and that is the complete list.

This started as a hot-path worry and ended as a deletion. Two features wanted git, and neither survived contact
with what it cost:

- **Showing the oldest untriaged item's age** needed a `git log` on every run of the most frequent command in
  the tool — tens of milliseconds to render a number whose only message is "there is a backlog". The count
  already says that.
- **Staging moves and retitles through `git mv`** turned out to buy nothing. Git infers renames from content
  similarity at commit time whether or not the move was staged through it, so a plain rename produces the
  identical diff. `git mv` only stages, and staging is the operator's business.

## Consequences

No git service to fake in tests, no child-process dependency, and no failure mode where the tool misbehaves
inside a worktree, a submodule, or a directory that is not a repository at all.

Bearing still **assumes** it lives in a git repository — deletion-on-close only makes sense where something
remembers. It just never talks to it. The tracker is committed by the same hands and in the same commits as the
work, which was always the design.

Nothing on the frontier path is expensive, which is what makes
[The frontier is derived, never stored (ADR 0003)](./0003-the-frontier-is-derived-never-stored.md) affordable.
