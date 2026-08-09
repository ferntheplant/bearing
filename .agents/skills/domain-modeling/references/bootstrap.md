# Bootstrapping `docs/README.md`

Read this only when a repo has no `docs/README.md`. It creates one — the format spec that this skill then defers
to for the rest of the repo's life.

Do not create the whole tree up front. `docs/README.md` describes homes that get created lazily, each one the
moment it has a first real entry.

## Steps

1. **Confirm there is something to write.** Bootstrapping is triggered by a real first artifact — a term to
   define, a decision to record, a capability to describe. Do not scaffold ahead of one.
2. **Decide where undecidedness goes.** This is the only part of the template that needs a per-repo answer, and
   it is the part most likely to rot if skipped. Three workable answers, in descending order of preference:
   - the repo has an issue tracker or a project tracker, and open questions go there;
   - open questions are raised in conversation and either become decisions or are dropped;
   - the repo keeps a single `docs/open-questions.md`, accepting that a second register of undecidedness
     competes with the first.
     Ask the user which, and fill the **Where undecidedness goes** slot below with their answer. Do not leave
     the slot as written.
3. **Write `docs/README.md`** from the template below, deleting the sections for homes the repo will not use.
   Keep the reading rule and the one-home-per-fact table in every case — they are what the rest of the file
   depends on.
4. **Write the first artifact** in its new home, using the format the file now specifies.
5. **Point the repo's agent instructions at it.** If `AGENTS.md` or `CLAUDE.md` exists, add `docs/README.md` to
   whatever "where things live" guidance it carries. A format spec nothing links to is a format spec nobody
   reads.

## Template

Adapt the prose; keep the structure. The parenthetical notes in braces are instructions, not content.

````md
# How this documentation works

This file is the format spec for everything under `docs/`{, plus any root-level docs the repo keeps}. It
describes the documentation system; every other file describes {the system}. That split is the point: a reader
looking for what {the system} does should never have to step over a paragraph about how the docs are organised.

The `domain-modeling` skill defers to this file. Where the skill and this file disagree, this file wins — it
ships with the repo, and a reader who has never heard of the `.agents/` convention can still find it.

## The reading rule

**If something is not written in an ADR or a capability file, it is not decided.**

Silence means open. There is no third register — no "Still open" section, no parked-questions file, no
provisional-answers appendix. A second place to record undecidedness competes with the first, and a question
filed in a document nobody consults when choosing what to work on next is a question that has been hidden
rather than tracked.

{**Where undecidedness goes** — the answer from step 2, in one or two sentences.}

## One home per fact

| The writing is…                                            | Home                 |
| ---------------------------------------------------------- | -------------------- |
| What a word means, and which near-synonyms to avoid        | `CONTEXT.md`         |
| Why something is the way it is                             | `docs/adr/`          |
| What the system does for its user, and how far along it is | `docs/capabilities/` |
| Why something that looks broken isn't                      | `docs/gotchas.md`    |

Nothing lives in two of them. When a paragraph could sit in two homes, cut it to a link from one to the other.

## Citing a decision

Cite an ADR by **name and number, name first**: `[Name (ADR 0011)](../adr/0011-slug.md)`. The name is what reads
at a glance; the number is what a file search finds. A bare `ADR 0011` is not a citation.

## ADRs

`docs/adr/NNNN-slug.md`, sequential. Scan for the highest number and increment.

```md
# {Short title of the decision}

{1-3 sentences: the context, what was decided, and why.}
```

An ADR can be a single paragraph. Add **Consequences** only when a downstream effect is non-obvious, and
**Considered options** only when a rejected alternative is worth remembering. Offer one only when the decision
is hard to reverse, surprising without context, and the result of a real trade-off. Amending in place is normal
when the decision is unchanged and only a consequence drawn from it was wrong.

## Capability files

`docs/capabilities/NN-slug.md`, numbered in the order a user meets them, with a `README.md` catalogue.
Descriptive behaviour in the vocabulary of `CONTEXT.md`; it points at the decisions that shaped it and never
restates them.

```md
# {Capability name}

{One paragraph: what this does for its user.}

## What you can expect

- **A bolded claim**, then the prose that qualifies it.

## Where it stands

**{Built | Partial | Designed | Fog}.** {What runs today, and what does not.}

## Decisions

- [Decision name (ADR NNNN)](../adr/NNNN-slug.md) — one clause on why it shaped this capability.
```

**Stands at**: **Built** (reachable through a real entrypoint and tested), **Partial** (some of it runs; the
file names what is missing), **Designed** (decided and written down, no production path), **Fog** (named, shape
not settled).

{Where the repo holds numbered acceptance criteria — an `ABSTRACT.md`, a PRD, a test plan — add an
`## Acceptance criteria` section naming the ones each capability owns, plus a column in the catalogue table, and
state that every criterion is owned by exactly one capability. Skip both when there is no such document; do not
invent criteria to fill the section.}

## `CONTEXT.md`

The ubiquitous language: what each term means and which near-synonyms not to use.

```md
**Order**:
{One or two sentences. What it IS, not what it does.}
_Avoid_: purchase, transaction
```

Be opinionated — pick one word and list the rest under `_Avoid_`. Only terms specific to this project; general
programming concepts do not belong however much they are used. No implementation details: it is a glossary, not
a spec.

## `docs/gotchas.md`

Behaviour that looks like a defect in our code and is not — something the runtime, registry, or toolchain chose
for us, or something chosen deliberately as the weaker mechanism until a decision nobody has taken yet. If we
picked one option over a genuine alternative for reasons a reader would wonder about, that is an ADR.

**Every entry names the obvious-looking simplification that reintroduces the problem.** The bold lead is the
whole finding. Keep the measurement and when it was taken. Delete entries that stop being true.
````

## After bootstrapping

This skill reads `docs/README.md` from now on and never re-runs these steps. If the repo's conventions drift
from the template, the repo is right — edit `docs/README.md`, not this file. Change this file only when the
_seed_ should be different for the next repo.
