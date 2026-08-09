# Setup and the shipped skill

Adopting bearing in a repository, and getting the method along with the tool. This is the only command that may
be interactive; later runs update the installation.

## What you can expect

- **`bearing init` creates `.bearing/` and installs the skill**, in one gesture, in the directory where it runs.
  A repo that adopts bearing gets the method at the same moment as the tracker.
- **There is no configuration.** Every tracker command walks upward from its current directory and uses the
  nearest `.bearing/`. A malformed nearest tracker is an error, never a reason to skip to another ancestor.
- **The skill lands where the repo already keeps its agent files**, detected rather than assumed.
- **Re-running updates without clobbering.** Users edit installed skills, so an update either detects local
  modification and skips, or writes alongside.
- **The skill is versioned with the CLI**, shipped in the same package. A skill that shipped separately would
  eventually teach a command surface that no longer exists.
- **The skill covers both modes**: charting a map from a loose idea, and walking one a ticket at a time.
- **Its centre is the graduation step** — resolving one design ticket typically yields a short ordered run of
  build tickets, with blockers wired in one pass and done-when written as an assertion someone could check
  rather than an intention.
- **It hands off rather than half-doing the next step.** The skill's job ends at a ticket someone could pick up.
  Turning that into the repo's own execution contract is the repo's job, with the repo's own format.
- **`bearing completion <shell>`** generates shell completions.

## Where it stands

**Designed.** Nothing is built. The fixed tracker location and discovery rule are settled; the skill's text and
installation mechanics remain the two active design tickets for this capability.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **1** (setup creates the tracker and installs the skill),
**2** (re-running does not discard a local edit), **28** (upward discovery, no subprocesses, and commands work
outside a git repository) and **29** (direct mutations apply immediately and nothing shipped names the flag that
applies a design close).

Criteria 28 and 29 are properties of the whole binary rather than of setup specifically. They sit here because
this is the capability that puts bearing into a repository, and because both are checked by the packaging: the
first is a dependency that does not exist, the second is a grep over what ships.

## Decisions

- [Bearing installs its own skill (ADR 0023)](../adr/0023-bearing-installs-its-own-skill.md) — why installation
  rather than a plugin, and what the method carries from each ancestor.
- [Bearing stops at the repo's edge (ADR 0014)](../adr/0014-bearing-stops-at-the-repos-edge.md) — why there is no
  configuration and where the skill stops.
- [`.bearing/` is fixed and discovered upward (ADR 0028)](../adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)
  — where setup creates the tracker and how every other command finds it.
- [Only design-ticket closing is a dry run (ADR 0029)](../adr/0029-only-design-ticket-closing-is-a-dry-run.md) —
  why setup is still the one command allowed to prompt.
- [The confirmation flag is undocumented on purpose (ADR 0016)](../adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
  — the constraint the skill's text has to respect, enforced in CI.
