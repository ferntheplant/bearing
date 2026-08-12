---
type: build
project: mvp
---

# Rename a ticket with `bearing retitle`

## Background

The title lives in the filename, so retitling by hand is how you get an id whose slug lies — which is why
bearing owns this one filename operation and no other editing command
([The filename is the only place an id appears (ADR 0006)](../../docs/adr/0006-the-filename-is-the-only-place-an-id-appears.md),
[Tracker files are edited directly (ADR 0030)](../../docs/adr/0030-tracker-files-are-edited-directly.md)).

It is also the first mutation with an ordering contract. The new name is written before the old one is deleted,
so an interrupted retitle leaves a duplicate id that `bearing check` rejects, never a ticket that silently
vanished ([Mutations are ordered, not atomic (ADR 0025)](../../docs/adr/0025-mutations-are-ordered-not-atomic.md)).

## Scope

Add `bearing retitle <id> "..."`. Re-derive the slug from the new title, write the new filename, then delete the
old, carrying the file's bytes across unchanged.

Out of scope: rewriting the body's heading. The body is prose bearing does not parse, and a retitle that edited
it would be bearing writing prose.

## Done when

- `bearing retitle <id> "..."` renames the file, preserves the id, and modifies no other file.
- The file's contents are byte-for-byte identical across the rename.
- The plan writes the new path before unlinking the old, and a failure after the write leaves both files rather
  than neither.
- Retitling to a title that slugifies to the current slug is a successful no-op and exits 0.
- An id prefix resolves here as it does everywhere, and an ambiguous one exits 1 naming the candidates.
- The command applies on its first invocation with no dry run.
- `vp run ready` passes from a clean checkout.
