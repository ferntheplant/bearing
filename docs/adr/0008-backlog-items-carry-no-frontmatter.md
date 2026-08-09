# Backlog items carry no frontmatter

An untriaged item has no fields at all — being in the backlog _is_ its status. It still gets an id, because
triage needs a handle to name.

The test for what belongs there is **scoping, not volume**. An earlier framing said a backlog item is a title
and a couple of sentences, and anything longer is already sharp enough to be a ticket. That is wrong, and the
counterexample is the most common way real items arrive: you are working a ticket, testing turns up an adjacent
bug, and you know the reproduction exactly. Reproduction steps, failing output, the file you suspect — all of it
should go in while you have it, because you will not have it later. What is missing is not information. It is a
decision about whether this is worth doing, at what size, in whose lane.

## Consequences

A long, precise bug report with no owner and no size is exactly a backlog item, and writing it down cheaply and
completely is the point of the folder. Deciding what it costs is triage's job, later, deliberately.

The backlog also holds **unmoored fog** — something that cannot be specified and cannot yet be attached to any
destination. "Leave it in the backlog" is a real triage verdict rather than a failure to triage, which is what
keeps the count honest: the backlog is where projects come from, not a hygiene metric to drive to zero.
