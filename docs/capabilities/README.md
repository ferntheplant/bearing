# Capabilities

What bearing does for the person using it, one capability per file — first the six a piece of work passes
through in order, then the two that hold across all of them.

This is the catalogue of what bearing is **for**. [`ABSTRACT.md`](../../ABSTRACT.md) says what bearing is in one
page and holds the 29 acceptance criteria; [`CONTEXT.md`](../../CONTEXT.md) says what each word means;
[`docs/adr/`](../adr/) says why each thing is the way it is; this directory says what each capability delivers,
where it stands, and which of those criteria prove it.

Every criterion in `ABSTRACT.md` §8 is owned by exactly one capability, so a criterion nobody claims is a
visible gap rather than a silent one.

| #   | Capability                                                 | Stands at | §8 criteria    |
| --- | ---------------------------------------------------------- | --------- | -------------- |
| 1   | [Capture](./01-capture.md)                                 | Designed  | 3, 4           |
| 2   | [Triage](./02-triage.md)                                   | Designed  | 5, 6, 7        |
| 3   | [Tickets](./03-tickets.md)                                 | Designed  | 8, 9, 10, 11   |
| 4   | [Maps and fog](./04-maps-and-fog.md)                       | Designed  | 12, 13, 14, 15 |
| 5   | [The frontier](./05-the-frontier.md)                       | Designed  | 16–20          |
| 6   | [Closing](./06-closing.md)                                 | Designed  | 21–25          |
| 7   | [Integrity](./07-integrity.md)                             | Designed  | 26, 27         |
| 8   | [Setup and the shipped skill](./08-setup-and-the-skill.md) | Designed  | 1, 2, 28, 29   |

**Stands at** means:

- **Built** — reachable through a real entrypoint and covered by tests.
- **Partial** — some of it runs today; each file names what is missing.
- **Designed** — decided and written down, no production path yet.
- **Fog** — named as a capability, but the shape is not settled.

Everything is **Designed**. Bearing has no code: six rounds of design conversation settled the shape, and the
next round is the first vertical slice — [`ABSTRACT.md`](../../ABSTRACT.md) §7 has the order it comes in.

## What belongs here

Descriptive behaviour, in the vocabulary of [`CONTEXT.md`](../../CONTEXT.md). A capability file says what a user
can expect and points at the decisions that shaped it — it does not restate them. Something that is really a
decision belongs in [`docs/adr/`](../adr/); a term belongs in `CONTEXT.md`; behaviour that looks like a defect
and is not belongs in [`docs/gotchas.md`](../gotchas.md); a claim about what "done" means for the whole system
belongs in [`ABSTRACT.md`](../../ABSTRACT.md).

An open question belongs in the **Still open** section of the capability it blocks, phrased as a question. It
does not get a link into the tracker —
[Nothing outside the tracker links into it (ADR 0002)](../adr/0002-nothing-outside-the-tracker-links-into-it.md).

## A note on command names

These files name commands as they were designed, and the whole surface is listed in
[`ABSTRACT.md`](../../ABSTRACT.md) §6. It is settled but unbuilt, so a name here is a commitment rather than an
observation, and the first slice is what will confirm it.
