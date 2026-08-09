# The confirmation flag is undocumented on purpose

The flag that applies a dry run is documented **in this repository and nowhere else**. It does not appear in
command help, it does not appear in the shipped skill, and no error message mentions it before a dry run has
run. The only place a caller learns it is the last line of the dry-run output — the output that also contains
the trail row and the fog patch.

That is the whole mechanism. The reason to make someone look at the trail row before deleting a ticket is that
the row is where the mistake hides, and an agent that knows the flag up front will go straight to it and never
read the row. The flag is not a safety interlock; it is a receipt that the review payload was on screen.
Advertising it in help text converts a forced read into an optional one and the feature evaporates.

This is deliberately weaker than it sounds, and worth being honest about: an agent that has already closed a
ticket this session knows the flag and will skip ahead. The bet is that most sessions start cold, so most closes
pay the two-command cost, and re-learning it each time is the correct outcome rather than friction to optimize
away. It is a nudge with good odds, not an enforcement mechanism — anything stronger would need state, and state
kept in order to make a human look at something is worse than the mistake it prevents.

## Consequences

The shipped skill describes the bare close command and stops. If the skill teaches the flag, every agent knows
it before its first close and the mechanism is decorative.

This is the kind of constraint that rots in six months when someone helpfully documents it, so CI greps the
shipped skill and the generated help output for the flag and fails if it appears. The test's failure message has
to explain why, not just assert.
