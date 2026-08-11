---
type: build
project: mvp
blockers: [n3dd4b]
---

# Resolve id prefixes behind `bearing show`

## Background

Every command that takes an id — `show`, `retitle`, `triage`, `close`, `rm` — accepts an unambiguous prefix
([The filename is the only place an id appears (ADR 0006)](../../docs/adr/0006-the-filename-is-the-only-place-an-id-appears.md)).
Nothing resolves one today, and each of those commands is a separate ticket on this map, so resolution needs a
home before the first of them lands rather than in whichever arrives first.

Resolution also produces the index that duplicate-id detection needs, which is why `bearing check` waits on this
ticket.

`bearing show` is the smallest real entrypoint that exercises it: one id in, one item out.

## Scope

Add prefix resolution to core's analysis: an index over every backlog item, ticket, and map in the observation,
and a resolve operation that returns the single match, or a distinguishable refusal for no match and for
ambiguity carrying the candidates.

Add `bearing show <id> [--full|--json]`. Resolution spans the whole tracker, so showing a backlog item and
showing a ticket are the same command.

Out of scope: `bearing ls` and its filters; the blocking graph; every mutation.

## Done when

- An unambiguous prefix resolves to its item, including a full six-character id.
- An ambiguous prefix exits 1 and names every candidate id; a prefix matching nothing exits 1 saying so.
- Two items sharing an id are reported as ambiguous rather than one of them being chosen.
- `bearing show <id>` prints the item's frontmatter fields and body; `--full` and `--json` are both accepted and
  `--json` emits the values rendered.
- Resolution is a core operation returning a value, with `apps/cli` doing the rendering.
- Starting in a nested directory below the tracker, `bearing show` resolves against the nearest ancestor's
  `.bearing/`.
- `vp run ready` passes from a clean checkout.
