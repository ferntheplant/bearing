---
type: build
project: mvp
blockers: [twwbzc, 3j66kq]
---

# Close a build ticket and delete with `bearing rm`

## Background

Closing is deletion, and this is the ticket where deletion first happens
([The tracker holds only what is not yet canonicalized (ADR 0001)](../../docs/adr/0001-the-tracker-holds-only-what-is-not-yet-canonicalized.md)).
A build ticket closes with no checks at all: its evidence is the diff it ships with, and bearing does not inspect
the working tree, the commit, or the map.

The work that is not trivial is stripping the closed id out of every blocker list, which is a lossless rewrite of
another ticket's frontmatter — the first time bearing edits a file it did not write. It needs the blocking graph
to know which files those are, which is why `3j66kq` blocks this.

Order matters and is fixed. The closing ticket is deleted first, then blocker lists are cleaned, so an
interrupted close leaves satisfied blockers that `bearing check` reports and never dependents made ready while
their blocker still exists
([Mutations are ordered, not atomic (ADR 0025)](../../docs/adr/0025-mutations-are-ordered-not-atomic.md)).

## Scope

Add `bearing close <id>` for a build ticket, its alias `done`, and `bearing rm <id>` with its alias `delete`.
Build the lossless blocker-stripping rewrite both share.

Out of scope: closing a design ticket and closing a map, which have their own gates and their own tickets.

## Done when

- `bearing close <id>` on a build ticket deletes it on the first invocation without reading the working tree,
  any commit, or its map.
- Closing strips the id from every ticket whose blocker list names it.
- A rewritten ticket differs only in its `blockers` value; body, other frontmatter keys, and key order are
  byte-for-byte unchanged.
- A blocker list that becomes empty has the `blockers` key removed rather than left as `[]`.
- The deletion is applied before any blocker list is rewritten.
- `bearing rm` deletes any item — backlog, ticket, or otherwise resolvable — immediately, with the same blocker
  stripping and no close semantics.
- `bearing close` on a design ticket does **not** fall through to this path.
- Both apply on their first invocation with no dry run.
- `vp run ready` passes from a clean checkout.
