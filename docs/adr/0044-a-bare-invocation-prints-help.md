# A bare invocation prints help

`bearing` with no arguments prints help. It used to render the frontier, so that an agent could ask "what next"
in one word and `bearing next` was the same command under a longer name. That saved a word on a command an agent
issues from a script, and spent it on the one question every human asks a tool first — what is this, and what can
it do — answered with a report about someone else's tracker.

`bearing next` is now the only way to the frontier, which costs the agent nothing it notices and makes bearing
behave the way every other CLI on the machine behaves.

## Consequences

The root command keeps its handler rather than losing it, because the framework's default command _is_ the root
handler (see `docs/gotchas.md`); the handler now raises the framework's help signal instead of deriving a value.
Nothing else changes: `--json` on a bare invocation is meaningless rather than special-cased, and the frontier's
promise that nothing is stored is untouched.
