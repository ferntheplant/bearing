# Setup and the shipped skill

Adopting bearing in a repository, and getting the method along with the tool. This is the only interactive
command in bearing, and it runs once.

## What you can expect

- **`bearing init` sets the tracker path and installs the skill**, in one gesture. A repo that adopts bearing
  gets the method at the same moment as the binary.
- **One configuration key: where the tracker lives.** That is genuinely the whole of it. Nothing about how the
  repo builds, tests, or validates itself is configuration, because none of it is bearing's business.
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
- **`bearing completion <shell>`** for shell completions, and **`bearing config <key>[=<value>]`** for reading
  or setting the one key.

## Where it stands

**Designed.** Nothing is built. What the skill teaches, where it installs, and the one-key configuration are
settled; the installation mechanics are a research task rather than an open decision.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **1** (setup writes the configuration and installs the
skill), **2** (re-running does not discard a local edit), **28** (no subprocesses, and every command works
outside a git repository) and **29** (nothing shipped names the flag that applies a dry run).

Criteria 28 and 29 are properties of the whole binary rather than of setup specifically. They sit here because
this is the capability that puts bearing into a repository, and because both are checked by the packaging: the
first is a dependency that does not exist, the second is a grep over what ships.

## Decisions

- [Bearing installs its own skill (ADR 0023)](../adr/0023-bearing-installs-its-own-skill.md) — why installation
  rather than a plugin, and what the method carries from each ancestor.
- [Bearing stops at the repo's edge (ADR 0014)](../adr/0014-bearing-stops-at-the-repos-edge.md) — why there is
  one config key and where the skill stops.
- [A dry run and a re-run, never a prompt (ADR 0015)](../adr/0015-a-dry-run-and-a-re-run-never-a-prompt.md) —
  why this is the one command allowed to prompt.
- [The confirmation flag is undocumented on purpose (ADR 0016)](../adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
  — the constraint the skill's text has to respect, enforced in CI.
