---
type: design
project: mvp
clears: [skill-installation-mechanics]
---

# Skill installation mechanics

**How much of `skills add`'s shape should bearing adopt for installing its own skill?**

`bearing init` has to detect which agent-directory convention a repository already uses, write the skill without
clobbering a locally edited copy, and behave sensibly when re-run to update
([Bearing installs its own skill (ADR 0023)](../../docs/adr/0023-bearing-installs-its-own-skill.md), and §8
criteria 1 and 2). All three are solved in [vercel-labs/skills](https://github.com/vercel-labs/skills), so this
is research before it is a decision: read how `skills add` handles each, then decide what to take.

The three sub-questions, in the order they bite:

1. **Detection.** Which conventions are worth detecting, and what happens in a repo that uses none of them or
   two of them at once. This repo has `.agents/` with a `.claude` symlink pointing at it, which is already a
   case a naive detector gets wrong.
2. **Not clobbering.** ADR 0023 leaves it as "either skips or writes alongside" — that is two behaviours, not
   one, and they are distinguishable to a user. Detecting local modification needs a comparison basis, which
   means either a checksum written somewhere or a byte comparison against the shipped copy.
3. **Re-running.** What an update does when the shipped skill has changed _and_ the local copy has been edited,
   which is the case that actually happens.

Constraints that are not up for grabs: no subprocess
([Bearing never spawns a subprocess (ADR 0018)](../../docs/adr/0018-bearing-never-spawns-a-subprocess.md)), so
nothing shells out to `git` or to another CLI; and setup is the one command allowed to prompt
([A dry run and a re-run (ADR 0015)](../../docs/adr/0015-a-dry-run-and-a-re-run-never-a-prompt.md)), so a
question here is legitimate where it would not be anywhere else.

Settles as an ADR, and probably an edit to the setup capability's promises where the two-behaviour ambiguity in
ADR 0023 gets resolved into one.
