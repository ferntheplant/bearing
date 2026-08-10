# Setup and the shipped skill

Adopting bearing in a repository, and getting the method along with the tool. This is the only command that may
be interactive; later runs update the installation.

## What you can expect

- **`bearing init` creates `.bearing/` and installs the skill**, in one gesture, in the directory where it runs.
  A repo that adopts bearing gets the method at the same moment as the tracker.
- **There is no configuration.** Every tracker command walks upward from its current directory and uses the
  nearest `.bearing/`. A malformed nearest tracker is an error, never a reason to skip to another ancestor.
- **The skill has one repository-local home.** Bearing recognizes `.agents/skills` and `.claude/skills`, resolves
  symlink aliases to one physical destination, uses the sole existing convention, and defaults to `.agents` when
  neither exists. First-time setup asks for one when both exist at distinct locations.
- **The installed skill carries bearing's ownership marker.** A re-run keeps using that location even if the
  repository later gains the other convention. A same-named skill bearing does not own is a collision, not
  something setup adopts or overwrites.
- **Untouched skills update; edited skills stay untouched.** A re-run replaces an installation that still
  matches its recorded digest. If any file differs, it leaves the whole tree byte-for-byte intact, reports a
  successful skipped update, and never writes a second copy.
- **The skill is versioned with the CLI**, shipped in the same package. A skill that shipped separately would
  eventually teach a command surface that no longer exists.
- **The skill covers both phases**: the mapping pass that turns accumulated fog into a batch of tickets, and the
  walk that works the batch until the map is fogbound again.
- **Its centre is the mapping pass** — every patch leaves as a ticket, as a decision landed on the spot, or as
  fog carrying the reason it survived, with blockers wired in a second sweep and done-when written as an
  assertion someone could check rather than an intention.
- **It hands off rather than half-doing the next step.** The skill's job ends at a ticket someone could pick up.
  Turning that into the repo's own execution contract is the repo's job, with the repo's own format.
- **`bearing completion <shell>`** generates shell completions.

## Where it stands

**Designed.** Nothing is built. Tracker discovery and skill installation are settled; the skill's text and the
first release path remain active design tickets for this capability.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **1** (setup creates the tracker and installs the skill),
**2** (untouched skills update and edited skills are preserved), **26** (upward discovery, no subprocesses, and
commands work outside a git repository) and **27** (direct mutations apply immediately and nothing shipped names
the flag that applies a design close).

Criteria 26 and 27 are properties of the whole binary rather than of setup specifically. They sit here because
this is the capability that puts bearing into a repository, and because both are checked by the packaging: the
first is a dependency that does not exist, the second is a grep over what ships.

## Decisions

- [Bearing installs its own skill (ADR 0023)](../adr/0023-bearing-installs-its-own-skill.md) — why installation
  rather than a plugin, and what the method carries from each ancestor.
- [One owned skill installation, updated only while untouched (ADR 0036)](../adr/0036-one-owned-skill-installation-updated-only-while-untouched.md)
  — how setup chooses one physical home and preserves an edited installation.
- [Bearing stops at the repo's edge (ADR 0014)](../adr/0014-bearing-stops-at-the-repos-edge.md) — why there is no
  configuration and where the skill stops.
- [`.bearing/` is fixed and discovered upward (ADR 0028)](../adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)
  — where setup creates the tracker and how every other command finds it.
- [Only design-ticket closing is a dry run (ADR 0029)](../adr/0029-only-design-ticket-closing-is-a-dry-run.md) —
  why setup is still the one command allowed to prompt.
- [The confirmation flag is undocumented on purpose (ADR 0016)](../adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
  — the constraint the skill's text has to respect, enforced in CI.
