# A dry run and a re-run, never a prompt

Every command that would change the tracker prints what it would do and changes nothing. Re-running the same
command with a confirmation flag applies it. Bearing has no interactive prompts anywhere except first-time
setup, which runs once, at a keyboard, before any of this exists.

The design goal is that bearing is fully operable by an agent, and an interactive prompt is the one thing an
agent cannot answer — it blocks, or worse, something guesses a default on its behalf. A confirmation prompt and
a re-run carry the same information and force the same second look, but the second is a transcript: two
commands, both replayable, both legible in scrollback afterwards.

Closing a design ticket is where this earns the most. It is the one moment anyone is looking at the answer, the
trail, and the fog at the same time, so the dry run puts all three on screen: the trail row **verbatim**, the fog
patches still present, the file that would be deleted, and the blockers that would be released. A row written
three commits ago and since invalidated passes a mere existence check and fails anyone who reads it; printing it
at closing time is what catches that.

## Consequences

The hard gate stays a refusal rather than a warning: a design ticket cannot close unless its map's trail has a
row for it with a non-empty outcome.

Build tickets check nothing. Their evidence is the diff they ship with, so the deleting commit _is_ the record.
An advisory warning for deleting a build ticket in an otherwise-empty commit was considered and rejected: a
ticket's work is a series of commits on a branch and the last of them closes the ticket, so that commit
routinely touches nothing else. A warning that fires on the normal case is noise.

Every mutation splits into a plan and an apply as separate operations, with the CLI's only rule being which one
the flag runs. See [Core returns values; only the CLI renders (ADR 0019)](./0019-core-returns-values-only-the-cli-renders.md).
