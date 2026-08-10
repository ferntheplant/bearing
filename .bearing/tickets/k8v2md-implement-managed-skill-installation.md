---
type: build
project: mvp
blockers: [qrqrbn]
---

# Implement managed skill installation

## Background

[One owned skill installation, updated only while untouched (ADR 0036)](../../docs/adr/0036-one-owned-skill-installation-updated-only-while-untouched.md)
sets the behavior of `bearing init`.
[Bearing installs its own skill (ADR 0023)](../../docs/adr/0023-bearing-installs-its-own-skill.md) makes that
skill part of the package, while [`.bearing/` is fixed and discovered upward (ADR 0028)](../../docs/adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)
sets the tracker half of setup. The skill's final contents are blocked on **What the skill teaches versus what
the repo documents**; this ticket owns making the settled installation behavior reachable through `bearing
init` once that artifact lands.

## Scope

Implement setup planning and applying through the existing filesystem and path services. A first installation
creates the tracker and installs the packaged skill into one physical `.agents/skills` or `.claude/skills`
location: resolve aliases, use the sole existing convention, default to `.agents/skills`, and let the setup
command ask for one destination when both exist distinctly. Keep every prompt import confined to setup.

Write an ownership marker carrying the bearing version and packaged-tree digest. On re-run, find the owned
installation before convention detection. Replace the whole tree only when it still matches the recorded digest;
otherwise preserve it byte-for-byte and return a successful skipped-update result for the CLI to render. Refuse
an unowned same-name collision, a malformed marker, or multiple distinct owned installations before writing
anything. Do not shell out, merge files, create a second skill copy, or add tracker configuration.

## Done when

- `bearing init` through the real entrypoint creates all three tracker directories and one usable packaged skill
  from a repo with no tracker and no agent directory.
- Tests cover `.agents` only, `.claude` only, neither, distinct both with selection, and this repository's
  `.claude -> .agents` alias without a prompt or duplicate copy.
- Re-running against an untouched older fixture updates the skill and marker; re-running against a tree with an
  added, removed, or changed file preserves the complete tree and reports the skipped update with exit status 0.
- An unowned collision, malformed marker, or two physical owned installs fails before creating or changing the
  tracker or either skill location.
- Setup remains the only prompt import, all production mutations retain separate planning and applying
  operations, and `vp run ready` passes.
