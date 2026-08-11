---
type: build
project: mvp
blockers: [twwbzc]
---

# Create tickets with `bearing new`

## Background

Creating a ticket directly is the other way work enters the tracker, alongside triage promoting something out of
the backlog. It reuses the id minting and plan-and-apply from `twwbzc` and adds frontmatter.

The one behaviour with a real refusal in it: `bearing new design` with no project is an error that names the
maps that exist, so the next command is obvious. Not a prompt, not a default, not a map created behind your back
— a design ticket is a question, and a question belongs to a map.

## Scope

Add `bearing new <type> "title" [--project X]` with its aliases `create` and `add`. Write the frontmatter that
[Three frontmatter fields, and the body is prose (ADR 0024)](../../docs/adr/0024-three-frontmatter-fields-and-the-body-is-prose.md)
specifies, omitting an empty blocker list rather than writing `[]`.

Out of scope: any body scaffolding beyond the title heading. What a good design question or a good done-when
looks like is taught by the installed skill, not stamped into a template
([ADR 0024](../../docs/adr/0024-three-frontmatter-fields-and-the-body-is-prose.md)).

## Done when

- `bearing new build "..."` creates a build ticket belonging to no project, with no `project` key in its
  frontmatter.
- `bearing new design "..."` with no project exits 1, names every map that exists, and creates nothing.
- `bearing new <type> "..." --project X` where no map named X exists exits 1 naming the maps that exist, and
  creates nothing.
- A created ticket writes no `blockers` key.
- `create` and `add` behave identically to `new`.
- The command applies on its first invocation with no dry run.
- `vp run ready` passes from a clean checkout.
