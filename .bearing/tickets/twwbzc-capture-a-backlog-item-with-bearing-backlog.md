---
type: build
project: mvp
blockers: [n3dd4b, 5sg7nk]
---

# Capture a backlog item with `bearing backlog`

## Background

This is the first mutation, and it carries the two things every later mutation reuses: minting an id, and the
plan-then-apply split that [Core exposes operations, not tracker internals (ADR 0027)](../../docs/adr/0027-core-exposes-operations-not-tracker-internals.md)
puts inside core and [Only design-ticket closing is a dry run (ADR 0029)](../../docs/adr/0029-only-design-ticket-closing-is-a-dry-run.md)
says a direct mutation runs in one invocation.

It is the right first mutation because it is the only one that cannot damage anything: it adds a file and
touches nothing existing.

The id and slug rules are already specified — six characters of lowercased Crockford base32, and a slug
truncated to 60 characters at the last hyphen that fits, falling back to `untitled`
([Three frontmatter fields, and the body is prose (ADR 0024)](../../docs/adr/0024-three-frontmatter-fields-and-the-body-is-prose.md)).
Acquisition already parses both; nothing generates either.

## Scope

Add id minting and slug derivation to core, plus the planning and applying operations a mutation is made of, and
build `bearing backlog "..."` on them. Add bare `bearing backlog` to list the backlog, which is what you want
immediately before triage.

A minted id is checked against the ids already in the observation, so generation never collides with something
on disk.

Out of scope: every other mutation. This ticket establishes the shape; the tickets after it use it.

## Done when

- `bearing backlog "..."` writes `backlog/<id>-<slug>.md` carrying the title as a heading, an id, and no
  frontmatter, in one invocation with no other input.
- Bare `bearing backlog` lists the backlog.
- A title that slugifies to nothing produces `untitled`; a title over 60 characters truncates at the last hyphen
  that fits and never mid-word.
- Every minted id matches the acquisition filename pattern and contains none of `i`, `l`, `o`, `u`.
- Minting refuses to return an id already present in the tracker.
- The command plans and applies in one invocation, with the plan a value core returns and the apply a separate
  core operation the CLI invokes immediately.
- Capture into a nested directory writes to the nearest ancestor's `.bearing/`, and refuses a malformed one.
- `vp run ready` passes from a clean checkout.
