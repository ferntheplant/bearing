---
type: build
project: mvp
---

# Deepen the reader into lossless tracker acquisition

## Background

The first vertical slice reads only `tickets/`, fails on the first malformed file, and discards the source prose.
[Core exposes operations, not tracker internals (ADR 0027)](../../docs/adr/0027-core-exposes-operations-not-tracker-internals.md)
sets the next shape: one private, lossless acquisition behind command-shaped core operations.
[`.bearing/` is fixed and discovered upward (ADR 0028)](../../docs/adr/0028-dot-bearing-is-fixed-and-discovered-upward.md)
sets how the CLI reaches it.

## Scope

Replace the ticket-only disk read with an internal acquisition that enumerates `backlog/`, `tickets/`, and
`maps/` once and reads each Markdown file once. Retain exact source plus parsed-or-malformed observations;
collect ticket filename and frontmatter diagnostics rather than stopping at the first one. Backlog items and maps
must retain filename identity and exact source and validate enough local structure that no malformed document is
silently omitted. Derived map, fog, and trail analysis comes next.

Replace the CLI's positional tracker argument with discovery that walks upward from the current directory and
uses the nearest `.bearing/`. A missing tracker, a malformed nearest tracker, or a collision at that path must
fail without searching farther upward.

Route the existing ticket-list operation through the valid ticket projection without changing its successful
CLI text or JSON. A list against malformed ticket documents must refuse with all relevant structured diagnostics;
filesystem access failures remain separate structured failures. Do not settle process exit codes in this ticket.

## Done when

- The existing list command and package interface still run end to end on a valid tracker.
- Tests prove one enumeration per tracker directory, one read per Markdown file, exact source retention, and
  accumulation of multiple malformed ticket diagnostics.
- A malformed ticket is never silently omitted, and an unreadable directory or file remains distinguishable
  from malformed tracker content.
- A malformed backlog item or map also refuses listing, even though this slice derives no backlog or map view.
- CLI tests cover nested discovery, nearest-ancestor precedence, no tracker, and a malformed nearest `.bearing/`
  with a valid tracker farther upward.
- `vp run ready` passes.
