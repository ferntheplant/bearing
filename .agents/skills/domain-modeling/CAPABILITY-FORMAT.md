# Capability Format

Capabilities live in `docs/capabilities/`, one file per capability, numbered in the order a user meets them:
`01-slug.md`, `02-slug.md`. A `README.md` in the same directory is the catalogue.

Create the directory lazily — only when the first capability is worth describing.

## What a capability file is

**Descriptive behaviour, in the vocabulary of `CONTEXT.md`.** It answers "what does this system do for the
person using it, and how far along is it?" It is not a spec, not a design document, and not a place decisions
get made. A capability file **points at** the decisions that shaped it and never restates them.

The catalogue is the answer to "what is this system _for_", written so that a gap is visible rather than
silent: every capability names where it stands, so nothing is quietly half-built.

## Template

```md
# {Capability name}

{One short paragraph: what this capability does for its user, and where it sits relative to the others.}

## What you can expect

- **A bolded claim**, then the prose that qualifies it.
- One bullet per promise. Write what the user gets, not what the code does.

## Where it stands

**{Built | Partial | Designed | Fog}.** {What actually runs today, and what does not.}

## Decisions

- [Decision name (ADR NNNN)](../adr/NNNN-slug.md) — one clause on why it shaped this capability.
- [Another decision (ADR NNNN)](../adr/NNNN-slug.md)

## Still open

- The question, phrased as a question. Not a link to where it is tracked.
```

## Stands at

The four values are fixed, and the point of them is that "Designed" is an honest answer:

- **Built** — reachable through a real entrypoint and covered by tests.
- **Partial** — some of it runs today; the file names what is missing.
- **Designed** — decided and written down, no production path yet.
- **Fog** — named as a capability, but the shape is not settled. Say what is unclear.

A repo that also refuses gracefully in places may add **Refuses honestly** — the route exists and returns a
refusal rather than a plausible success.

## The catalogue README

```md
# Capabilities

{One or two sentences: what this directory is, and how it relates to the other homes.}

| #   | Capability                 | Stands at |
| --- | -------------------------- | --------- |
| 1   | [Capture](./01-capture.md) | Designed  |
| 2   | [Triage](./02-triage.md)   | Designed  |

**Stands at** means: {the legend above.}

## What belongs here

{The routing rule — a decision goes to docs/adr/, a term to CONTEXT.md, an open question to the Still open
section of the capability it belongs to.}
```

Where the repo holds numbered acceptance criteria somewhere (an `ABSTRACT.md`, a PRD, a test plan), add an
`## Acceptance criteria` section to each capability naming the ones it owns, and a column to the catalogue
table. Every criterion should be owned by exactly one capability, so an unclaimed criterion is a visible gap.
Skip both when there is no such document — do not invent criteria to fill the section.

## Rules

- **One home per fact.** A capability links the ADR behind a behaviour; it does not summarise the reasoning. If
  you find yourself explaining _why_, you are writing an ADR.
- **Use the glossary's words exactly.** The capability catalogue is the largest body of prose in the repo, so it
  is where vocabulary drift shows up first.
- **Carry provisional answers, and mark them.** A default nobody has reviewed is still the starting position a
  reader has to react to. Say it is provisional and say what would settle it.
- **Every capability has a `Where it stands`.** A file without one is a wish.
- **Split when the file grows two audiences.** If half a file is about what a user does and half is about how it
  is operated, those are two capabilities.
