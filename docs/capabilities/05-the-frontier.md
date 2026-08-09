# The frontier

The answer to "what next", computed fresh every time you ask. This is the command bearing exists to make good,
and the one an agent runs on every turn.

## What you can expect

- **Three sections, in this order:**
  - **BUILD** — open, unblocked build tickets, flat and ranked. Each row is tagged with its project where it has
    one, because that tag is the pointer to the trail the ticket rests on.
  - **DECIDE** — open, unblocked design tickets, grouped by project, each group headed by its destination and
    fog count.
  - **TRIAGE** — the size of the backlog.
- **Build outranks decide.** Something already specified and unbuilt is the answer to "what next"; going back to
  the map is what you do when it runs out.
- **Ranking is derived, never assigned.** Build tickets rank by how many tickets they transitively unblock.
  Design tickets rank by that plus the fog they claim to clear, so a ticket whose whole purpose is to burn off
  three patches does not score zero.
- **A fog-complete map drops out of DECIDE** while its build tickets are still running — the map goes quiet
  before it goes away.
- **The backlog shows as a count and nothing more.** The count already says "there is a backlog"; an age would
  say the same thing at the cost of asking git on the most frequently run command in the tool.
- **Nothing is stored.** No file says what is next, so there is no rebuild step, no stale view, and no way for
  the frontier to disagree with the tracker.
- **`--json` on every read**, and `NO_COLOR` respected, because the primary caller is an agent.
- **A status dashboard is the default command**, so bare `bearing` is useful and `bearing next` is the frontier
  itself.

## Where it stands

**Designed.** Nothing is built. The three sections, the ranking inputs, and the ordering between them are
settled. The performance budget — under 50ms wall on a real tracker — is a target measured against a prototype,
not against bearing.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **16** (the three sections, in order), **17** (blocked work
is absent, and deleting the blocker is the only edit needed), **18** (fog breaks a ranking tie; a fog-complete
map leaves DECIDE), **19** (`--json` on every read) and **20** (under 50ms wall).

## Decisions

- [The frontier is derived, never stored (ADR 0003)](../adr/0003-the-frontier-is-derived-never-stored.md)
- [Ranking is derived from the blocking graph and fog (ADR 0004)](../adr/0004-ranking-is-derived-from-the-blocking-graph-and-fog.md)
  — why there is no priority field and no hierarchy.
- [Bearing never spawns a subprocess (ADR 0018)](../adr/0018-bearing-never-spawns-a-subprocess.md) — why the
  backlog's age display was cut.
- [Bun only, no node fallback (ADR 0021)](../adr/0021-bun-only-no-node-fallback.md) — where the 50ms budget
  comes from.
