---
name: domain-modeling
description: Build and sharpen a project's domain model and the durable docs around it. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, describe what the system does for its user, capture behaviour that looks like a defect and isn't, or when another skill needs to maintain the domain model.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the _active_ discipline — challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely _reading_ `CONTEXT.md` for vocabulary is not this skill — that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## Where writing goes

Four homes, and **nothing lives in two of them**. A piece of durable prose belongs to exactly one:

| The writing is…                                            | Home                 | Format                                         |
| ---------------------------------------------------------- | -------------------- | ---------------------------------------------- |
| What a word means, and which near-synonyms to avoid        | `CONTEXT.md`         | [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md)       |
| Why something is the way it is                             | `docs/adr/`          | [ADR-FORMAT.md](./ADR-FORMAT.md)               |
| What the system does for its user, and how far along it is | `docs/capabilities/` | [CAPABILITY-FORMAT.md](./CAPABILITY-FORMAT.md) |
| Why something that looks broken isn't                      | `docs/gotchas.md`    | [GOTCHAS-FORMAT.md](./GOTCHAS-FORMAT.md)       |

The most common failure is a capability file that re-argues its own decision, or an ADR that grows a description
of the feature. When a paragraph could sit in two homes, cut it down to a link from one to the other.

An open question belongs in the **Still open** section of the capability it blocks, phrased as a question — not
as a link to wherever it is being tracked.

## File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   │   ├── 0001-event-sourced-orders.md
│   │   └── 0002-postgres-for-write-model.md
│   ├── capabilities/
│   │   ├── README.md
│   │   └── 01-placing-an-order.md
│   └── gotchas.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed. Same for `docs/capabilities/` and `docs/gotchas.md`: a capability file the moment a capability is worth describing to its user, a gotcha the moment something looks like a defect and isn't.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

Cite an ADR by **name and number, name first** — `[Readiness is a claim (ADR 0003)](./docs/adr/0003-readiness-is-a-claim-not-authority.md)`. The name is what reads at a glance; the number is what a file search finds. A bare `ADR 0003` is not a citation.

### Keep the capability catalogue honest

When the session changes what a user can expect — a promise gained, a promise qualified, a stage that now
actually runs — update the capability file in the same breath, including its **Where it stands**. The catalogue
is only useful while "Designed" and "Built" mean what they say; one file that overstates its state costs the
reader trust in all of them.

Two moves matter more than the writing:

- **Route the question, don't answer it in place.** A decision that surfaces while writing a capability becomes
  an ADR the capability links. A term that surfaces becomes a `CONTEXT.md` entry.
- **Close the loop when an ADR lands.** A new decision usually changes some capability's promise or its **Still
  open** list. Check which one, and edit it.

Use the format in [CAPABILITY-FORMAT.md](./CAPABILITY-FORMAT.md).

### Record gotchas as they bite

When something behaves in a way that looks like a bug in our code and isn't — the runtime chose it, the driver
chose it, the registry chose it — write it down while the diagnosis is still in your head, along with the
measurement or version that proves it. Name the obvious-looking simplification that reintroduces the problem;
that sentence is what makes the entry worth keeping.

Do not offer a gotcha for something we chose against a real alternative. That is an ADR. Use the format in
[GOTCHAS-FORMAT.md](./GOTCHAS-FORMAT.md).
