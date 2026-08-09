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
- **Fog is coarser than a ticket on purpose.** The test: a ticket when you can state the question precisely now,
  even if it is blocked; fog when you cannot phrase it that sharply.
- **Each fog patch is a real anchor**, so it resolves in an editor or a web view and tickets can link it in
  prose as well as in frontmatter.
- **A design ticket declares the fog it intends to clear** at creation, in one pass. Those links are advisory: a
  broken one warns, never fails, because rephrasing fog and clearing fog are both normal.
- **`bearing fog` shows the patches and which tickets are chasing each**, per project or across all of them.
- **Drift gets named, not guessed.** When a heading is reworded, the integrity pass says which link broke,
  suggests the closest current heading, and prints the exact command that repoints the ticket. Applying it is
  your decision.
- **A map outlives its own fog.** Once nothing is left to chart it stops appearing among decisions to make, but
  it stays until its last ticket closes, because its trail is what the remaining build work rests on.

## Where it stands

**Designed.** Nothing is built. The map's sections, the fog test, the advisory-link semantics, and the drift
mechanism are settled.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **12** (a destination and one patch is a project), **13**
(patches listed with the tickets chasing each), **14** (drift warns with the closest heading and the repoint
command) and **15** (repointing edits the ticket and leaves the map byte-for-byte unchanged).

## Decisions

- [Bearing reads maps and never writes them (ADR 0009)](../adr/0009-bearing-reads-maps-and-never-writes-them.md)
  — why the one file with real conflict potential stays hand-written.
- [The trail is append-only and a row is a pointer (ADR 0010)](../adr/0010-the-trail-is-append-only-and-a-row-is-a-pointer.md)
  — why every design ticket gets a row, including the ones that ended badly.
- [Fog links are advisory, not referential (ADR 0011)](../adr/0011-fog-links-are-advisory-not-referential.md) —
  the deliberate looseness, and the two things it buys.
- [Anchor drift is detected and named, never repaired (ADR 0012)](../adr/0012-anchor-drift-is-detected-and-named-never-repaired.md)
  — why a reworded heading and a cleared patch look identical to a tool.
- [A map lives until its last ticket closes (ADR 0013)](../adr/0013-a-map-lives-until-its-last-ticket-closes.md)
  — the two endings, and why there is no archive.
- [Three flat directories, and a project is a map file (ADR 0005)](../adr/0005-three-flat-directories-and-a-project-is-a-map-file.md)

## Still open

- Fog has no lifecycle at all — no ids, no partial graduation, no record of a patch that half-cleared. That is
  deliberate, and the question is whether it survives a project big enough to have twenty patches.
