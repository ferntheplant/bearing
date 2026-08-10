---
name: wayfinder
description: Work a fog of war — chart a map from a loose idea, then alternate mapping passes and walks until the destination is reached. Use when work is too large for one session and the route to the destination is not yet visible, or when a map is fogbound.
---

# Wayfinder

A method for exploring work whose destination is known but whose route is not: **chart a map, walk it, and take a new bearing when the view changes.**

## The shape of the work

Bearing keeps its tracker in `.bearing/`, discovered by walking upward from the current directory, with three flat directories:

- `backlog/` — things written down before anyone has committed to them.
- `tickets/` — commitments: work someone has decided to do, at a known size. A **design ticket** closes as an artifact; a **build ticket** closes as a commit.
- `maps/<project>.md` — a project's **destination**, the **fog** between here and it, and the **trail** of what has already been settled.

## Chart the map

For a loose idea, first name the destination in a line or two, then burn off the fog by working every patch it contains. A patch leaves a pass exactly three ways:

- **Graduate to tickets.** The patch becomes one or more tickets.
- **Settle on the spot.** The question is answered now, and the answer lands as a durable artifact.
- **Survive as fog.** The patch stays, carrying the reason it survived.

A patch that can be stated sharply becomes a ticket, not fog. A live ticket and a live patch never describe the same question.

## Walk the batch

Take the tickets a pass produced, one at a time, until the map is fogbound again. Wire blockers before writing ticket bodies — a blocker is satisfied when it no longer exists — and write every ticket's done-when as an assertion someone could check, not an intention.

Fog discovered while walking is written down and deliberately left unsorted until the next pass.

## Take a new bearing

A map that still has fog and no charted design work is **fogbound**: nothing will advance it but another mapping pass. Report that signal rather than improvising a second kind of planning.

## Where the method stops

The method's job ends at a ticket someone could pick up. Turning that ticket into the repository's own execution contract — its gate command, its testing seam, its acceptance criteria — is the repository's job, in the repository's own format. Do not half-write it.

Drive the tracker with the `bearing` command; the tracker's own files are Markdown and are edited directly.
