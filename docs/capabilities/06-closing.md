# Closing

Finishing something, which in bearing means deleting it in the same change that lands the work. This is the
capability the rest of the design is arranged around: because closing is deletion, everything present in the
tracker is live.

## What you can expect

- **Closing deletes the file and strips the id from every ticket blocked by it.** There is no completed state,
  no archive directory, and no recovery path — the deleting commit is the record.
- **A build ticket closes with no checks at all.** Its evidence is the diff it ships with, and that is
  recoverable from history. Bearing does not inspect the working tree or the commit.
- **A design ticket closes against its trail row.** The map's trail must have a row for it with a non-empty
  outcome, and that is a refusal rather than a warning.
- **Closing a design ticket is a dry run first.** It prints the ticket, the trail row **verbatim**, the fog
  patches it claimed to clear and whether they are still present, the file it would delete, and the tickets it
  would unblock. Re-running the same command applies it.
- **The trail row is shown, not just checked.** A row written three commits ago and since invalidated passes an
  existence check and fails anyone who reads it; printing it at closing time is what catches that.
- **Bearing cannot clear the fog for you.** It prints the patch and says so, because it never edits a map.
- **Closing a map is the same operation.** It refuses while any ticket still names it, and otherwise deletes the
  file. Nothing is written out to a permanent home on the way — by then every trail row already points at
  something durable.
- **`bearing rm` deletes without closing**, for the ticket that turned out not to be real.
- **No prompts.** The second look is a dry run and a re-run, which is a transcript rather than a question an
  agent cannot answer.
- **Deleting the ticket inside the change that lands the work is deliberate.** A reviewer seeing the ticket
  disappear in the diff is seeing the change's claim about what it finished.

## Where it stands

**Designed.** Nothing is built. The asymmetry between the two types, the hard gate on the trail row, and the
dry-run payload are settled.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **21** (the dry run shows the row verbatim and changes
nothing), **22** (the re-run deletes and strips blockers), **23** (refusal on a missing or empty trail row),
**24** (a build ticket closes with no inspection) and **25** (closing a map refuses while anything names it).

## Decisions

- [The tracker holds only what is not yet canonicalized (ADR 0001)](../adr/0001-the-tracker-holds-only-what-is-not-yet-canonicalized.md)
  — why closing is deletion.
- [A dry run and a re-run, never a prompt (ADR 0015)](../adr/0015-a-dry-run-and-a-re-run-never-a-prompt.md) —
  what the dry run puts on screen, and why a build-close warning was rejected.
- [The confirmation flag is undocumented on purpose (ADR 0016)](../adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
  — which is why this file does not name it either.
- [Bearing reads maps and never writes them (ADR 0009)](../adr/0009-bearing-reads-maps-and-never-writes-them.md)
  — why clearing the fog patch stays yours.
- [A map lives until its last ticket closes (ADR 0013)](../adr/0013-a-map-lives-until-its-last-ticket-closes.md)
- [No archaeology; git remembers (ADR 0017)](../adr/0017-no-archaeology-git-remembers.md) — what you get instead
  of an undo.
