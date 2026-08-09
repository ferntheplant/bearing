# No archaeology; git remembers

Bearing has no command that recovers a deleted item, searches history, or explains what a closed ticket said.
An earlier draft had one — give it an id, find the commit that deleted the ticket, print it. It is cut entirely,
and the reasoning is general enough that this kind of command will be proposed again.

Making it reliable meant imposing real constraints on everything around it: full clone depth, care about how
branches merge, full-length ids everywhere instead of the short prefixes the rest of the CLI accepts, and one
tracker per repository for a second reason. Those are constraints on the daily-use design, paid permanently, to
support a command that gets run rarely and always in a forensic mood — the mood where you are already prepared
to open git.

And it was never the only way to get the answer. A single `git log --diff-filter=D` invocation does it, and it
degrades honestly: where history is shallow it says so in git's own vocabulary rather than in a bearing error
message that has to explain the same thing.

## Consequences

"Git remembers" in [The tracker holds only what is not yet canonicalized (ADR 0001)](./0001-the-tracker-holds-only-what-is-not-yet-canonicalized.md)
is a statement about where the record lives, not a promise that bearing will fetch it.

What remains is the trail, which is the archaeology that is actually consulted — in the moment, by someone
working the map, for decisions that are still shaping the work. That was always the useful half.
