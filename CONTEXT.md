# Bearing

Bearing is a file-based issue tracker and CLI for exploring a **fog of war**: work too large for one agent
session, where the route to the destination is not yet visible. This file is the project's ubiquitous language:
what each term means, and which near-synonyms not to use.

The vocabulary is navigational on purpose. You take a bearing, walk it, and take another when the view changes —
so the tool's words are about position and movement rather than about workflow states. Where a common tracker
word would have done (backlog, board, sprint, status), bearing either means something narrower by it or does not
have the concept at all, and the `_Avoid_` lists are where that shows.

**Every term here is doubly loaded, and there is no way around it.** Bearing tracks bearing, so this repository
both defines these words and contains instances of them: "the trail" is the name of a section in the map format
_and_ the actual trail in `.bearing/maps/mvp.md`; "the destination" is a concept _and_ a paragraph someone
wrote. Nothing distinguishes the two readings except context, and no naming scheme would — the collision is the
dogfooding rather than a mistake in it. The habit that keeps it survivable is being explicit whenever both
readings are live: say _the map format's trail_ or _this project's trail_, never the bare noun.

## The system

**Bearing**:
The whole thing — the tracker, the CLI, and the method it ships. Also the name of this repository.

**bearing**:
The command. One binary, operable end to end by an agent.

**tracker**:
The directory of Markdown files bearing manages, committed alongside the code it is about. It holds what has
been committed to and not yet canonicalized into the repo — never an audit of what was done.
_Avoid_: issue database, board, project management, backlog (that is one folder inside it).

**mechanism**:
Behaviour that ships with bearing and is not configurable — that closing is deletion, that a blocker is
satisfied when it no longer exists.

**policy**:
What counts as durable _here_, what a project is worth doing, which skills a session should read. Policy is
prose a person writes in a map's Notes. Bearing never parses it.

**method**:
How a question actually gets settled — by conversation, by a rough prototype, by reading third-party docs.
Method lives in the ticket body and in the shipped skill, never in a type or a field.

## Work

**backlog item**:
Something written down before anyone has committed to it. It has no owner and no size; it may be long and
precise. Being in the backlog _is_ its status.
_Avoid_: note, idea, inbox item, TODO.

**ticket**:
A commitment: work someone has decided to do, at a known size, in a known lane. A ticket exists from the moment
it is committed to until the moment it is finalized into the repo, and then it is deleted.
_Avoid_: issue, task, card, story.

**design ticket**:
A ticket that **closes as an artifact**. Its outcome is knowledge, so it must land somewhere durable — a
decision record, a document, a captured measurement. Sized to one agent session. Always belongs to a project.

**build ticket**:
A ticket that **closes as a commit**. Its outcome is a diff, so the change that deletes it is its own evidence.
May belong to a project, or to none.

**blocker**:
A ticket named by another ticket as standing in its way. A blocker is satisfied when it no longer exists —
including when it was absorbed, invalidated, or dropped rather than answered.
_Avoid_: dependency, parent.

**id**:
The six-character handle that identifies an item for life. It survives promotion out of the backlog and
survives a retitle. It is for typing at a shell; it is not what prose calls a thing.
_Avoid_: key, ticket number, ref.

**slug**:
The human-readable half of an item's name, derived from its title. Changes when the title changes.

## The map

**map**:
A decisioning instrument: what the destination is, what fog lies between here and it, and what has been settled
so far. A map exists only where work is genuinely ill-defined.
_Avoid_: plan, roadmap, epic doc.

**project**:
A map. There is no separate thing — a project _is_ its map, and a ticket belongs to a project by naming it.
Well-defined work has no project.
_Avoid_: epic, milestone, initiative, workstream.

**destination**:
What reaching the end of a project looks like, in a line or two. Naming one is the work that earns a map its
existence.
_Avoid_: goal, objective, definition of done (that is a ticket's, not a project's).

**Notes**:
The map's standing context — the domain, the skills every session should consult, the preferences that hold
across the whole project. Prose, for humans and agents to read, never for bearing to parse.

**trail**:
The record of design tickets already closed, in the order they closed, each row pointing at where its answer
landed. What you leave behind you.
_Avoid_: route (the route is the thing ahead, and a fog of war means you do not have it), history, changelog,
decision log.

**fog**:
Work that cannot yet be stated as a question sharply enough to be a ticket. The material a map exists to burn
off.
_Avoid_: unknowns, TBD, uncertainty.

**patch**:
One named region of fog. Coarser than a ticket and deliberately so.
_Avoid_: fog ticket, placeholder.

**unmoored fog**:
Fog that cannot be attached to any destination yet, and so waits in the backlog rather than on a map. "Leave it
in the backlog" is a real verdict, not a failure to triage.

**graduation**:
A patch of fog becoming one or more tickets during a mapping pass. The pass consumes the patch, so a live ticket
and a live patch never describe the same question.

**fog-complete**:
A map with no fog left and no design ticket naming it. It has stopped being a decisioning instrument and lives
on for its trail until its last build ticket closes.

**fogbound**:
A map with fog left and no design ticket naming it. It has run out of charted work while fog remains, and the
only thing that advances it is a mapping pass.
_Avoid_: blocked (that word names an edge in the ticket graph and nothing else), stuck, stalled.

**out of scope**:
A boundary the project declared up front. Distinct from a boundary discovered while walking, which is a trail
row.

## Working

**mapping pass**:
A deliberate breadth-first pass over every patch a map holds, in which each patch leaves as one or more tickets,
as a decision landed on the spot, or as fog that survives carrying the reason it survived. The first one charts
the map; every later one is the same operation.
_Avoid_: planning, grooming, refinement, remapping (there is no separate later kind).

**walking**:
Working the batch a mapping pass produced. Fog discovered while walking is written down and deliberately left
unsorted until the next pass.
_Avoid_: execution, delivery, sprint.

**triage**:
Giving a backlog item the cheapest home that fits: delete it, ticket it, attach it to a project, start a
project, or leave it. Triage is where projects come from.

**closing**:
Deleting an item in the same change that lands its work. There is no completed state and no archive; git holds
what was deleted.
_Avoid_: resolving, completing, archiving, marking done.

**canonicalization**:
The moment reasoning lands in the repo's own durable form. Everything before it is bearing's business;
everything after it is the repo's.

**durable artifact**:
Where a design ticket's answer lives once it is canonical — a decision record, a capability description, a
glossary entry, a committed measurement. What counts as durable is policy, so each project says.
_Avoid_: documentation, deliverable, output.

**frontier**:
The derived answer to "what next": the build work that is ready, the decisions that are ready, and the size of
the backlog. Nothing stores it; every run computes it.
_Avoid_: queue, sprint, next-up list, roadmap.

**gate count**:
How many tickets a ticket transitively unblocks. It is derived, and it is the only ranking bearing has.
_Avoid_: priority, severity, points, weight.

**dry run**:
The first invocation of closing a design ticket: it prints the trail row and planned edits, and the same command
re-run takes effect. Every other mutation applies directly.
_Avoid_: preview, confirmation prompt (bearing has none).

**spec**:
The repo's own execution contract for a piece of work — its testing seam, its gate command, its acceptance
criteria. Bearing does not write one and does not know the format. A build ticket is a commitment; writing the
spec is what canonicalizes it.
_Avoid_: using "spec" for a build ticket, or "ticket" for a spec.

**wayfinder**:
The method for working a fog of war — charting a map from a loose idea, then alternating mapping passes and
walks until the destination is reached. Bearing ships it as the `bearing-wayfinder` skill and installs it into
the repo it is tracking.
