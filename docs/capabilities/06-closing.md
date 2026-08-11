# Closing

Finishing something, which in bearing means deleting it in the same change that lands the work. This is the
capability the rest of the design is arranged around: because closing is deletion, everything present in the
tracker is live.

## What you can expect

- **Closing deletes the file and strips the id from every ticket blocked by it.** There is no completed state,
  no archive directory, and no recovery path — the deleting commit is the record.
- **Closing is ordered, not atomic.** The closing ticket is deleted before blocker lists are cleaned. If the
  apply is interrupted, the remaining references are satisfied blockers that `bearing check` reports, never
  dependents made ready while their blocker still exists.
- **A build ticket closes with no checks at all.** Its evidence is the diff it ships with, and that is
  recoverable from history. Bearing does not inspect the working tree or the commit, and closes it immediately.
- **A design ticket closes against its trail row.** The map's trail must have a row for it with a non-empty
  outcome, and that is a refusal rather than a warning.
- **Closing a design ticket is a dry run first.** It prints the ticket, the trail row **verbatim**, the file it
  would delete, and the tickets it would unblock. Re-running the same command applies it.
- **The trail row is shown, not just checked.** A row written three commits ago and since invalidated passes an
  existence check and fails anyone who reads it; printing it at closing time is what catches that.
- **New fog is yours to write.** Working a ticket routinely reveals more of it. Bearing never edits a map, so
  that lands in `Not yet specified` by hand — and stays unsorted there until the next mapping pass.
- **Closing a map applies immediately.** It refuses while any ticket still names it, and otherwise deletes the
  file on that invocation. Nothing is written out to a permanent home on the way — by then every trail row
  already points at something durable.
- **Closing a map is a flag, not an argument.** Closing a ticket is the command anyone types a hundred times
  more often, and resolving one argument as either an id or a map name would make the common case ambiguous to
  save a flag on the rare one.
- **`bearing rm` deletes without closing**, immediately, for the ticket that turned out not to be real.
  `done` is an alias for `close`, and `delete` for `rm`.
- **No prompts.** A design close's second look is a dry run and a re-run, which is a transcript rather than a
  question an agent cannot answer.
- **Deleting the ticket inside the change that lands the work is deliberate.** A reviewer seeing the ticket
  disappear in the diff is seeing the change's claim about what it finished.

## Where it stands

**Designed.** Nothing is built. The asymmetry between the two types, the hard gate and dry-run payload for a
design close, and direct build and map closing are settled.

## Decisions

- [The tracker holds only what is not yet canonicalized (ADR 0001)](../adr/0001-the-tracker-holds-only-what-is-not-yet-canonicalized.md)
  — why closing is deletion.
- [Only design-ticket closing is a dry run (ADR 0029)](../adr/0029-only-design-ticket-closing-is-a-dry-run.md) —
  what earns the second look, and why build and map closing apply directly.
- [The confirmation flag is undocumented on purpose (ADR 0016)](../adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
  — which is why this file does not name it either.
- [Bearing reads maps and never writes them (ADR 0009)](../adr/0009-bearing-reads-maps-and-never-writes-them.md)
  — why writing down the fog a ticket revealed stays yours.
- [Structure in the map is written only at completion (ADR 0032)](../adr/0032-structure-in-the-map-is-written-only-at-completion.md)
  — why the trail row is written as the ticket closes and never in advance.
- [A map lives until its last ticket closes (ADR 0013)](../adr/0013-a-map-lives-until-its-last-ticket-closes.md)
- [No archaeology; git remembers (ADR 0017)](../adr/0017-no-archaeology-git-remembers.md) — what you get instead
  of an undo.
- [Mutations are ordered, not atomic (ADR 0025)](../adr/0025-mutations-are-ordered-not-atomic.md) — what a caller
  may assume after an interrupted close, and why bearing provides no transaction or rollback.
