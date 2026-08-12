---
name: domain-modeling
description: Build and sharpen a project's domain model and the durable docs around it. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, describe what the system does for its user, capture behaviour that looks like a defect and isn't, or when another skill needs to maintain the domain model.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the _active_ discipline —
challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they
crystallise. (Merely _reading_ `CONTEXT.md` for vocabulary is not this skill — that's a one-line habit any skill
can do. This skill is for when you're changing the model, not just consuming it.)

## Where the formats live

**The repo owns the formats, not this skill.** Before writing anything durable:

- **If `docs/README.md` exists, read it and follow it.** It is the format spec for that repo — where each kind
  of writing goes, how an ADR is structured, what a capability file must carry, how open questions are handled.
  Where it disagrees with anything below, it wins.
- **If it does not exist, bootstrap.** Read [references/bootstrap.md](./references/bootstrap.md) and follow its
  steps to create `docs/README.md` before writing the first ADR, capability, or gotcha.

Formats belong in the repo because a repo outlives any one agent's skill set: someone who has never heard of the
`.agents/` convention still has to read and extend these files. This skill carries the seed and the practice;
the repo carries the spec.

The one rule worth stating twice, because everything else follows from it: **nothing lives in two homes.** A
capability file links the decision behind a behaviour rather than restating it; an ADR records why rather than
describing the feature. When a paragraph could sit in two places, cut it to a link from one to the other.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately.
"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do
you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that
probe edge cases and force the user to be precise about where one concept ends and the next begins.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface
it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update `CONTEXT.md` inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen.

`CONTEXT.md` should be totally devoid of implementation details. Do not treat it as a spec, a scratch pad, or a
repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR.

### Keep the capability catalogue honest

When the session changes what a user can expect — a promise gained, a promise qualified, a stage that now
actually runs — update the capability file in the same breath, including its **Where it stands**. The catalogue
is only useful while "Designed" and "Built" mean what they say; one file that overstates its state costs the
reader trust in all of them.

Treat a capability catalogue `README.md` as an index unless the repository format says otherwise: update its
status metadata, not its prose with a second description of the behaviour. Before finishing, compare every
capability, ADR, and catalogue entry changed in the session. Every user promise must occur in one capability
file, every ADR must contain only decision and rationale, and every catalogue entry must contain only the fields
the repository format assigns it; replace repeated behaviour with a link or delete it.

Two moves matter more than the writing:

- **Route the question, don't answer it in place.** A decision that surfaces while writing a capability becomes
  an ADR the capability links. A term that surfaces becomes a `CONTEXT.md` entry.
- **Close the loop when an ADR lands.** A new decision usually changes some capability's promise. Check which
  one, and edit it.

### Record gotchas as they bite

When something behaves in a way that looks like a bug in our code and isn't — the runtime chose it, the driver
chose it, the registry chose it — write it down while the diagnosis is still in your head, along with the
measurement or version that proves it. Name the obvious-looking simplification that reintroduces the problem;
that sentence is what makes the entry worth keeping.

Do not offer a gotcha for something we chose against a real alternative. That is an ADR.

### Leave open questions where the project tracks them

A question that surfaces and does not get settled does **not** go into durable prose as a parked note or a link
to wherever it is tracked. Check `docs/README.md` for how that repo handles it. Absent any rule, say the
question out loud to the user and let them decide where it goes.
