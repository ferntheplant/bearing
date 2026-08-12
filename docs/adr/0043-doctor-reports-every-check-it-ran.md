# `bearing doctor` reports every check it ran

The integrity command is called `doctor`, and it lists every check by name with what that check found — including
the ones that found nothing. It was called `check` and printed findings only, so a clean tracker printed one line
saying so and a reader had no way to learn what had been looked at. "Did it check for duplicate ids?" was a
question only the source could answer.

`doctor` is the name other tools give this, and the rename is cheap now and expensive later. The command is a
deliberate one, run when something looks wrong, not the every-turn command — so a screen of passing checks is
the answer to the question being asked rather than noise, and it does not weaken
[Every warning names its fix (ADR 0012)](./0012-every-warning-names-its-fix.md): a finding still prints under its
check with the command that fixes it.

## Consequences

The domain returns the checks as an ordered list of named reports, and the CLI owns what each name is called in
English, per [Core returns values (ADR 0019)](./0019-core-returns-values-only-the-cli-renders.md). Adding an
integrity check now means adding it to that list, which is the point: a check that runs without appearing in the
report is the failure mode this format prevents.
