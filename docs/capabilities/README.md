# Capabilities

What bearing does for the person using it, one capability per file — first the six a piece of work passes
through in order, then the two that hold across all of them.

This is the catalogue of what bearing is **for**. [`ABSTRACT.md`](../../ABSTRACT.md) says what bearing is in one
page and holds the 27 acceptance criteria; [`CONTEXT.md`](../../CONTEXT.md) says what each word means;
[`docs/adr/`](../adr/) says why each thing is the way it is; [`docs/README.md`](../README.md) says how to write
any of them.

| #   | Capability                                                 | Stands at | §8 criteria  |
| --- | ---------------------------------------------------------- | --------- | ------------ |
| 1   | [Capture](./01-capture.md)                                 | Designed  | 3, 4         |
| 2   | [Triage](./02-triage.md)                                   | Designed  | 5, 6, 7      |
| 3   | [Tickets](./03-tickets.md)                                 | Partial   | 8, 9, 10, 11 |
| 4   | [Maps and fog](./04-maps-and-fog.md)                       | Partial   | 12, 13       |
| 5   | [The frontier](./05-the-frontier.md)                       | Designed  | 14–18        |
| 6   | [Closing](./06-closing.md)                                 | Designed  | 19–23        |
| 7   | [Integrity](./07-integrity.md)                             | Partial   | 24, 25       |
| 8   | [Setup and the shipped skill](./08-setup-and-the-skill.md) | Partial   | 1, 2, 26, 27 |

**Tickets, maps and fog, integrity, and setup are Partial; the other capabilities are Designed.** The read path
now discovers the nearest tracker, acquires all three directories without discarding malformed documents, and
projects valid tickets for text or `--json`. Derived map, fog, trail, and integrity analysis is still to come.

## A note on command names

These files name commands as they were designed, and the whole surface is listed in
[`ABSTRACT.md`](../../ABSTRACT.md) §6. Most of it is settled but unbuilt, so a name here is a commitment rather
than an observation.
