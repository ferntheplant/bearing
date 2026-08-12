# Capabilities

What bearing does for the person using it, one capability per file — first the six a piece of work passes
through in order, then the three that hold across all of them.

This is the catalogue of what bearing is **for**, and between them these files are the whole of what bearing
promises. [`ABSTRACT.md`](../../ABSTRACT.md) says what bearing is in one page and deliberately stops short of any
capability; [`CONTEXT.md`](../../CONTEXT.md) says what each word means; [`docs/adr/`](../adr/) says why each
thing is the way it is; [`docs/README.md`](../README.md) says how to write any of them.

| #   | Capability                                                 | Stands at |
| --- | ---------------------------------------------------------- | --------- |
| 1   | [Capture](./01-capture.md)                                 | Built     |
| 2   | [Triage](./02-triage.md)                                   | Designed  |
| 3   | [Tickets](./03-tickets.md)                                 | Partial   |
| 4   | [Maps and fog](./04-maps-and-fog.md)                       | Partial   |
| 5   | [The frontier](./05-the-frontier.md)                       | Built     |
| 6   | [Closing](./06-closing.md)                                 | Partial   |
| 7   | [Integrity](./07-integrity.md)                             | Built     |
| 8   | [Setup and the shipped skill](./08-setup-and-the-skill.md) | Partial   |
| 9   | [The command line](./09-the-command-line.md)               | Built     |

**Capture, the frontier, integrity, and the command line are Built; closing is Partial alongside tickets, maps
and fog, and setup; the other capabilities are Designed.** The read path discovers the nearest tracker, acquires
all three directories without discarding malformed documents, and projects valid tickets and backlog items for
text or `--json`. Id-prefix resolution across the whole tracker backs `bearing show`, and `bearing backlog "..."`
plans and applies a capture in one invocation, minting an id against the ids already on disk. `bearing ls`
filtering and the blocking graph it exposes are built. `bearing close` on a build ticket and `bearing rm` delete
immediately and strip the closed id from every blocker list as a lossless rewrite. `bearing doctor` reads the
whole tracker and reports all seven checks by name in one run — every parse failure, the five integrity error
classes, and the single warning — with the error/warning distinction carried in the `--json` output and the exit
status. Closing a map is still to come.

## A note on command names

These files name commands as they were designed, and between them they name the whole surface — there is no
second list to keep in step. Most of it is settled but unbuilt, so a name here is a commitment rather than an
observation.
