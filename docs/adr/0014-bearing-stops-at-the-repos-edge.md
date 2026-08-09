# Bearing stops at the repo's edge

Bearing tracks ideas and commitments before they are canonicalized. It knows nothing about how the repo builds,
tests, or validates itself: no gate command, no verification configuration, no validator discovery, no testing
seam.

The concrete thing cut was a fourth section on build tickets naming the seam its assertions would be made from,
plus a templated gate command in the done-when criteria. Both are gone, and the reason is worth recording
because the two concepts stay adjacent and will keep trying to merge:

> **A bearing build ticket is a commitment. A spec is an execution contract.**

The ticket says this will be built, here is why, here is what must be true when it is. The spec says how an
agent proves it: the testing seam, the gate command, acceptance criteria, the constraint profile. Those are
properties of the repo, and the moment bearing templates one it has an opinion about how the repo validates
itself.

The boundary is the same one deletion-on-close draws everywhere else. Writing the spec _is_ the
canonicalization, and it happens in the repo, in the repo's own format, with the repo's own skill. Where a repo
has no such format, done-when in prose is the whole of it, and that is a fine place to be — the ticket is still
legible to an agent, it just is not a contract.

## Consequences

**Configuration holds exactly one key: where the tracker lives.** Everything an earlier draft wanted config for
— what counts as durable, the gate command, where specs live — turned out to be either prose a person writes in
a map's notes or a thing bearing should not know. A tool with one key does not need a config format debate, and
the config command exists mostly so first-time setup has somewhere to write.

**Bearing build tickets are not directly executable.** The step from ticket to spec is real work bearing does
not do. That is the trade, and it is what keeps bearing usable in a repo that has never heard of specs.

The shipped skill inherits the same stopping point: its job ends at a ticket someone could pick up, and it hands
off explicitly rather than half-doing the next step.
