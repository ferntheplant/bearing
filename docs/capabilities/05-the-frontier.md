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
- **Ranking is derived, never assigned.** Every ticket ranks by how many tickets it transitively unblocks, and by
  nothing else. Inside a batch a mapping pass has just produced, that order comes entirely from the blockers
  wired in the pass's second sweep.
- **A fog-complete map drops out of DECIDE** while its build tickets are still running — the map goes quiet
  before it goes away.
- **A fogbound map is called out above the sections.** Fog left, no open design tickets: the map has run out of
  charted work and needs a mapping pass. It is reported even when BUILD and DECIDE are both empty, which is
  precisely when an unreported one would read as "nothing to do".
- **The backlog shows as a count and nothing more.** The count already says "there is a backlog"; an age would
  say the same thing at the cost of asking git on the most frequently run command in the tool.
- **Nothing is stored.** No file says what is next, so there is no rebuild step, no stale view, and no way for
  the frontier to disagree with the tracker.
- **`--json` on every read**, and `NO_COLOR` respected, because the primary caller is an agent.
- **A status dashboard is the default command**, so bare `bearing` is useful and `bearing next` is the frontier
  itself.

## Where it stands

**Designed.** Nothing is built. The three sections, the ranking input, the ordering between them, and the
fogbound status line are settled. The performance budget — under 50ms wall on a real tracker — is a target
measured against a prototype, not against bearing.

## Acceptance criteria

Owns [`ABSTRACT.md`](../../ABSTRACT.md) §8 criteria **14** (the three sections, in order), **15** (blocked work
is absent, and deleting the blocker is the only edit needed), **16** (a fog-complete map leaves DECIDE), **17**
(`--json` on every read), **18** (under 50ms wall) and **19** (a fogbound map is reported, including when the
frontier is otherwise empty).

## Decisions

- [The frontier is derived, never stored (ADR 0003)](../adr/0003-the-frontier-is-derived-never-stored.md)
- [Ranking is derived from the blocking graph (ADR 0004)](../adr/0004-ranking-is-derived-from-the-blocking-graph.md)
  — why there is no priority field and no hierarchy.
- [Nothing points at a fog patch (ADR 0033)](../adr/0033-nothing-points-at-a-fog-patch.md) — why there is no fog
  term in the ranking either.
- [A fogbound map is reported (ADR 0034)](../adr/0034-a-fogbound-map-is-reported.md) — why the starvation signal
  sits above the sections instead of becoming a fourth one.
- [Bearing never spawns a subprocess (ADR 0018)](../adr/0018-bearing-never-spawns-a-subprocess.md) — why the
  backlog's age display was cut.
- [Bun only, no node fallback (ADR 0021)](../adr/0021-bun-only-no-node-fallback.md) — where the 50ms budget
  comes from.
