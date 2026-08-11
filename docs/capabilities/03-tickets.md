# Tickets

The commitments themselves: creating them, reading them, editing their Markdown directly, and finding the ones
you care about. A ticket is work someone has decided to do — everything about its shape is in service of being
legible to whoever picks it up cold, human or agent.

## What you can expect

- **Two types and one test.** A design ticket closes as an artifact; a build ticket closes as a commit. That
  sentence is the whole discriminator, including for the awkward cases — provisioning access so an API can be
  judged is a design ticket, because its outcome is knowledge.
- **A design ticket's body is the question**, sized to one agent session. A build ticket's body is background
  citing what decided it, scope, and what must be true when it is done.
- **No status.** A ticket exists or it does not. There is nothing to update, nothing to move, and no board
  column to keep honest.
- **Blocking is by id and crosses projects freely**, because the decision frontier runs ahead of the build
  frontier. A ticket is unblocked when every id it names no longer exists, so an absorbed or invalidated blocker
  is a satisfied one. A design question that needs concrete build work to land remains a design ticket blocked
  by that build ticket; `bearing rm` is for a commitment that turned out not to be real.
- **A build ticket may belong to no project; a design ticket must belong to one.** `bearing new design` with no
  project is an error that names the maps that exist so the next command is obvious. Not a prompt, not a
  default, not a map created behind your back. `create` and `add` are aliases for `new`.
- **Ticket content is edited directly.** Bearing has no `edit` command and never launches an editor. Bodies and
  frontmatter are yours; `bearing check` reports structural mistakes.
- **`bearing retitle` owns renaming.** The title lives in the filename, so retitling by hand is how you get a
  name that lies; the id survives and no other file changes. The new name is written before the old one is
  deleted, so interruption can
  leave a duplicate id but cannot silently remove the ticket. Creating and retitling apply immediately.
- **`bearing ls` filters by type, readiness, blocked-ness, project, or a query**, and **`bearing show` prints
  one.** `show` takes an id or an unambiguous id prefix, renders the frontmatter fields and body, and `--full`
  prints the file's exact source. Both take `--json`, as every read in bearing does.
- **Short id prefixes work everywhere an id does** — three or four characters is usually enough to type. A
  prefix matching more than one item is an error that names the candidates, never a guess between them.

## Where it stands

**Partial.** `packages/core` acquires all three tracker directories losslessly, refuses malformed documents, and
projects valid ticket values for `apps/cli` to render or emit as `--json`
([Core returns values (ADR 0019)](../adr/0019-core-returns-values-only-the-cli-renders.md) is the seam between
them). Prefix resolution over the whole tracker is built as a core operation and backs `bearing show`, which
prints one backlog item or ticket. `bearing ls`'s filters, creation, and retitling remain settled, not built.

## Decisions

- [Two ticket types, discriminated by how they close (ADR 0007)](../adr/0007-two-ticket-types-discriminated-by-how-they-close.md)
  — including why there is no status field and why method is prose rather than a type.
- [The filename is the only place an id appears (ADR 0006)](../adr/0006-the-filename-is-the-only-place-an-id-appears.md)
  — why retitling is bearing's job and why prefixes are safe.
- [Bearing stops at the repo's edge (ADR 0014)](../adr/0014-bearing-stops-at-the-repos-edge.md) — why a build
  ticket has no verification section and no gate command, and what that costs.
- [A map lives until its last ticket closes (ADR 0013)](../adr/0013-a-map-lives-until-its-last-ticket-closes.md)
  — why a build ticket keeps naming its project for its whole life.
- [Mutations are ordered, not atomic (ADR 0025)](../adr/0025-mutations-are-ordered-not-atomic.md) — why an
  interrupted retitle fails toward a rejected duplicate rather than an absent ticket.
- [Tracker files are edited directly (ADR 0030)](../adr/0030-tracker-files-are-edited-directly.md) — why bearing
  owns the filename operation but not an editor command.
- [Only design-ticket closing is a dry run (ADR 0029)](../adr/0029-only-design-ticket-closing-is-a-dry-run.md) —
  why creation and retitle plan and apply in one invocation.
