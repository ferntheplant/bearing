# Maps and fog

The part of bearing that is actually about a fog of war. A map is where a destination gets named, where what you
cannot yet specify gets written down honestly, and where what you have already settled stays visible to whoever
picks up the work next.

## What you can expect

- **A project is a map.** There is no other thing — no directory, no config entry, no record. Creating a map
  creates the project; deleting it ends it.
- **A map carries five things**: the destination, notes that hold across the project, the trail of what has been
  settled, the fog that has not, and the boundaries declared out of scope up front.
- **Maps are yours to write.** Bearing parses them and validates them and never edits them. Standing preferences
  and what counts as durable _here_ are prose in the notes, and bearing never tries to read them.
- **Open tickets are not listed on the map.** They are found by scanning for the ones that name it — two places
  to keep in step means one of them rots.
- **Two different things make something fog**: you cannot answer it off the top of your head, or you cannot yet
  phrase it sharply enough to ticket. Both go in the same section. Telling them apart is the job of a mapping
  pass, not of the moment you write them down.
- **Fog is a dump, deliberately.** `Not yet specified` is where questions land unsorted as they occur to you, and
  it is also the complete agenda for the next mapping pass. There is no second list.
- **A mapping pass empties it, three ways.** Each patch leaves as one or more tickets, as a decision landed on
  the spot in something durable, or as fog that survives carrying the reason it survived. A patch still sitting
  there with no reason attached is one the pass never reached.
- **Graduating a patch consumes it.** The tickets it becomes replace it in the same edit, so the map never holds
  a live question that a live ticket is already holding.
- **Nothing points at a patch.** Tickets carry no fog link and ranking has no fog term, so rewording a heading
  breaks nothing — there was never a reference to break.
- **`bearing fog` lists the patches**, per project or across all of them.
- **A map outlives its own fog.** Once nothing is left to chart it stops appearing among decisions to make, but
  it stays until its last ticket closes, because its trail is what the remaining build work rests on.
- **A map with fog and no open decisions is fogbound**, and bearing reports it rather than leaving you to notice.
  That is the signal to run a mapping pass.

## Where it stands

**Partial.** Ticket listing now acquires every map and refuses one whose filename or five-section local shape is
malformed. Fog and trail parsing, map analysis, `bearing fog`, and both terminal states remain settled, not
built.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **12** (a destination and one patch is a project) and **13**
(`bearing fog` lists the patches).

## Decisions

- [Bearing reads maps and never writes them (ADR 0009)](../adr/0009-bearing-reads-maps-and-never-writes-them.md)
  — why the one file with real conflict potential stays hand-written.
- [The trail is append-only and a row is a pointer (ADR 0010)](../adr/0010-the-trail-is-append-only-and-a-row-is-a-pointer.md)
  — why every design ticket gets a row, including the ones that ended badly.
- [Mapping and walking alternate (ADR 0031)](../adr/0031-mapping-and-walking-alternate.md) — the three ways a
  patch leaves a pass, and why fog found while walking is left unsorted until the next one.
- [Structure in the map is written only at completion (ADR 0032)](../adr/0032-structure-in-the-map-is-written-only-at-completion.md)
  — why nothing structured is written ahead of the thing it records.
- [Nothing points at a fog patch (ADR 0033)](../adr/0033-nothing-points-at-a-fog-patch.md) — what was removed
  once graduation stopped needing a reference to survive it.
- [A map lives until its last ticket closes (ADR 0013)](../adr/0013-a-map-lives-until-its-last-ticket-closes.md)
  — the two endings, and why there is no archive.
- [A fogbound map is reported (ADR 0034)](../adr/0034-a-fogbound-map-is-reported.md) — the mirror state, and why
  it is a status rather than a queue.
- [Three flat directories, and a project is a map file (ADR 0005)](../adr/0005-three-flat-directories-and-a-project-is-a-map-file.md)
