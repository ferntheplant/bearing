# Maps and fog

The part of bearing that is actually about a fog of war. A map is where a destination gets named, where what you
cannot yet specify gets written down honestly, and where what you have already settled stays visible to whoever
picks up the work next.

## What you can expect

- **A project is a map.** There is no other thing — no directory, no config entry, no record. Creating a map
  creates the project; deleting it ends it. Its filename is `<slug>.md`, and that stable, slug-safe name is what
  tickets carry as their project.
- **A map carries six sections, in this order**: `Destination`, `Notes`, `Trail`, `Not yet committed`,
  `Not yet specified`, and `Out of scope` — what you are aiming at, what holds across the project, what has been
  settled, what you intend, what you cannot yet state, and the boundaries declared up front. They descend by
  certainty. Bearing checks that all six are present, in order, and that the destination says something.
- **Maps are yours to write.** Bearing parses them and validates them and never edits them. Policy that holds
  across the project is prose in the notes, and bearing never tries to read it. Notes are never drained — what
  is true of every map you keep belongs in your repository's own instructions, not in each map.
- **Open tickets are not listed on the map.** They are found by scanning for the ones that name it — two places
  to keep in step means one of them rots.
- **Intentions and fog are separate lists, and the test is certainty about _what_.** Something you are fairly
  sure you want, where only the commitment is missing, is an intention and goes in `Not yet committed`. Something
  you cannot yet phrase sharply enough to ticket is fog and goes in `Not yet specified`. Not size — an intention
  can be enormous and a patch of fog can be one sentence.
- **Both are dumps, deliberately.** Things land in either unsorted as they occur to you, and together they are
  the complete agenda for the next mapping pass. Moving something from fog to intentions as it sharpens is the
  normal case, not a correction.
- **Charting a map is sorting a loose idea across the two.** That first sort is most of what writing a map buys
  you, and it is why a destination plus something in either section is already a legitimate map.
- **A mapping pass empties both, three ways.** Each entry leaves as one or more tickets, as a decision landed on
  the spot in something durable, or as material that survives carrying the reason it survived. An entry still
  sitting there with no reason attached is one the pass never reached.
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

**Partial.** Acquisition validates a map's slug-safe filename and parses its destination, intentions, patches,
and trail rows — each retaining its exact source, and a malformed trail row kept as a diagnostic rather than a
thrown parse. `bearing fog` lists the patches on one map or across every map, and refuses an unknown project by
naming the maps that exist. The
fogbound and fog-complete states are reported through the frontier: a map with fog and no open design ticket is
called out above its sections, and a map with no fog and no open design ticket stops appearing in DECIDE while
its build tickets keep running. The mapping-pass method the fog is drained by is still not built — the shipped
skill is a placeholder.

## Decisions

- [Bearing reads maps and never writes them (ADR 0009)](../adr/0009-bearing-reads-maps-and-never-writes-them.md)
  — why the one file with real conflict potential stays hand-written.
- [The trail is append-only and a row is a pointer (ADR 0010)](../adr/0010-the-trail-is-append-only-and-a-row-is-a-pointer.md)
  — why every design ticket gets a row, including the ones that ended badly.
- [Mapping and walking alternate (ADR 0031)](../adr/0031-mapping-and-walking-alternate.md) — the three ways an
  entry leaves a pass, and why what is found while walking is left unsorted until the next one.
- [A map holds intentions alongside fog (ADR 0039)](../adr/0039-a-map-holds-intentions-alongside-fog.md) — why
  there are two lists rather than one, and why the second is not the backlog and not the notes.
- [Structure in the map is written only at completion (ADR 0032)](../adr/0032-structure-in-the-map-is-written-only-at-completion.md)
  — why nothing structured is written ahead of the thing it records.
- [Nothing points at a fog patch (ADR 0033)](../adr/0033-nothing-points-at-a-fog-patch.md) — what was removed
  once graduation stopped needing a reference to survive it.
- [A map lives until its last ticket closes (ADR 0013)](../adr/0013-a-map-lives-until-its-last-ticket-closes.md)
  — the two endings, and why there is no archive.
- [A fogbound map is reported (ADR 0034)](../adr/0034-a-fogbound-map-is-reported.md) — the mirror state, and why
  it is a status rather than a queue.
- [Three flat directories, and a project is a map file (ADR 0005)](../adr/0005-three-flat-directories-and-a-project-is-a-map-file.md)
