# How this documentation works

This file is the format spec for everything under `docs/`, plus `CONTEXT.md` and `ABSTRACT.md` at the root. It
describes the documentation system; every other file describes bearing. That split is the point: a reader
looking for what bearing does should never have to step over a paragraph about how the docs are organised, and
a reader changing the docs should find the rules in one place rather than inferring them from six examples.

The [`domain-modeling`](../.agents/skills/domain-modeling/SKILL.md) skill defers to this file. Where the skill
and this file disagree, this file wins — it ships with the repo, and a reader who has never heard of the
`.agents/` convention can still find it.

## The reading rule

**If something is not written in an ADR or a capability file, it is not decided.**

Silence means open. There is no third register — no "Still open" section, no parked-questions file, no
provisional-answers appendix. That is a deliberate removal: a second place to record undecidedness competes
with the tracker's own fog, and a question filed in a capability file is a question nobody consults when
choosing what to work on next. The cost is real and accepted — a provisional answer that used to be written
down now either becomes a decision or disappears — and it buys one place to look for what is settled and one
place to look for what is not.

Undecidedness that blocks a destination is **fog on a map** in the tracker. Undecidedness that blocks nothing is
simply absent, and rediscovered by whoever next needs it.

## One home per fact

| The writing is…                                            | Home                               |
| ---------------------------------------------------------- | ---------------------------------- |
| A claim about what the whole system is and is not          | [`ABSTRACT.md`](../ABSTRACT.md)    |
| What a word means, and which near-synonyms to avoid        | [`CONTEXT.md`](../CONTEXT.md)      |
| Why something is the way it is                             | [`adr/`](./adr/)                   |
| What the system does for its user, and how far along it is | [`capabilities/`](./capabilities/) |
| Why something that looks broken isn't                      | [`gotchas.md`](./gotchas.md)       |

Nothing lives in two of them. The most common failure is a capability file that re-argues its own decision, or
an ADR that grows a description of the feature. When a paragraph could sit in two homes, cut it to a link from
one to the other.

## Citing a decision

Cite an ADR by **name and number, name first**:

```md
[The trail is append-only (ADR 0010)](../adr/0010-the-trail-is-append-only-and-a-row-is-a-pointer.md)
```

The name is what reads at a glance; the number is what a file search finds. A bare `ADR 0010` is not a citation.
Paths are relative to the citing file — the example above is written as it would appear from a capability file,
which is where most citations live.

## ADRs

`docs/adr/NNNN-slug.md`, sequential. Scan for the highest number and increment.

```md
# {Short title of the decision}

{1-3 sentences: the context, what was decided, and why.}
```

An ADR can be a single paragraph. The value is recording _that_ a decision was made and _why_, not filling out
sections. Add **Consequences** only when a downstream effect is non-obvious, and **Considered options** only
when a rejected alternative is worth remembering.

Offer an ADR only when all three hold:

1. **Hard to reverse** — changing your mind later costs something.
2. **Surprising without context** — a future reader will wonder why.
3. **The result of a real trade-off** — there were genuine alternatives.

If a decision is easy to reverse you will just reverse it; if it is not surprising nobody will wonder; if there
was no alternative there is nothing to record beyond "we did the obvious thing."

**Amending an ADR in place is normal** when the decision it records is unchanged and only a consequence drawn
from it turned out to be wrong. Write a new ADR when the decision itself changes.

## Capability files

`docs/capabilities/NN-slug.md`, numbered in the order a user meets them, with a `README.md` as the catalogue.

Descriptive behaviour, in the vocabulary of `CONTEXT.md`. A capability file answers "what does this do for the
person using it, and how far along is it?" It **points at** the decisions that shaped it and never restates
them — if you find yourself explaining _why_, you are writing an ADR.

```md
# {Capability name}

{One paragraph: what this does for its user, and where it sits relative to the others.}

## What you can expect

- **A bolded claim**, then the prose that qualifies it. One bullet per promise, written as what the user gets.

## Where it stands

**{Built | Partial | Designed | Fog}.** {What actually runs today, and what does not.}

## Decisions

- [Decision name (ADR NNNN)](../adr/NNNN-slug.md) — one clause on why it shaped this capability.
```

**Stands at** has four values, and the point of them is that "Designed" is an honest answer:

- **Built** — reachable through a real entrypoint and covered by tests.
- **Partial** — some of it runs today; the file names what is missing.
- **Designed** — decided and written down, no production path yet.
- **Fog** — named as a capability, but the shape is not settled. Say what is unclear.

**The catalogue is the whole of what the system promises**, so a promise that is nowhere in it is not a promise.
There is no separate acceptance-criteria document, and adding one is the mistake this format exists to prevent:
criteria written outside the catalogue are a restatement of the bullets above them in testable voice, less
complete than the capability and less precise than the ticket that builds it. A bullet is the promise, a
ticket's **Done when** is the test, and **Where it stands** is the status.

That makes the catalogue the only place the surface is named. A command, a flag, or a format that appears in no
capability file does not exist, however reasonable it looks in a summary somewhere — and a summary listing the
whole surface in one place is the thing not to write, because it is the copy that rots while each capability
stays right.

Use the glossary's words exactly. The catalogue is the largest body of prose in the repo, so it is where
vocabulary drift shows up first.

## `CONTEXT.md`

The ubiquitous language: what each term means and which near-synonyms not to use.

```md
**Order**:
{One or two sentences. What it IS, not what it does.}
_Avoid_: purchase, transaction
```

- **Be opinionated.** When several words exist for one concept, pick one and list the rest under `_Avoid_`.
- **Only terms specific to this project.** General programming concepts do not belong however much they are used.
- **No implementation details.** It is a glossary, not a spec and not a scratch pad.
- **Group under subheadings** when natural clusters emerge.

## `docs/gotchas.md`

Behaviour that looks like a defect in our code and is not. Two kinds qualify: something the runtime, registry,
or toolchain chose for us; or something chosen deliberately as the weaker mechanism, standing until a decision
nobody has taken yet. If we picked one option over a genuine alternative for reasons a reader would wonder
about, that is an ADR.

**Every entry names the obvious-looking simplification that reintroduces the problem.** That is the whole point
of the file — each of these looks like tidiness to someone who did not hit it. An entry that does not name the
tidying it prevents is a note to nobody.

- **The bold lead is the whole finding.** Someone skimming bold text learns the fact without the paragraph.
- **Keep the measurement.** Write the number and when it was taken; "it was slow" rots into folklore.
- **Cite the ADR the gotcha constrains** rather than re-arguing it.
- **Delete entries that stop being true.** A gotcha whose upstream reason was fixed keeps a workaround alive.

Group under `##` headings by the area a reader would be working in when they hit it — not by severity, not
chronologically. A heading is worth adding at three entries.
