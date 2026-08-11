# Mapping and walking alternate

Work on a map runs in two phases that alternate. A **mapping pass** goes breadth-first over every piece of
uncharted material the map holds, and each leaves the pass in one of three ways: as one or more tickets, as a
decision landed on the spot in a durable artifact, or as material that survives carrying the reason it survived.
A second pass then wires blockers between the tickets just created. **Walking** works that batch, and what
closing a ticket turns up is written down and deliberately left unsorted until the next pass.

A pass drains two lists, intentions and fog — see
[A map holds intentions alongside fog (ADR 0039)](./0039-a-map-holds-intentions-alongside-fog.md), which added
the first of them. This decision originally spoke of fog alone.

The deferral is the decision. Sorting fog as it arrives sounds tidier and is not: recognising that a question
has become sharp and answering it are the same act when done one patch at a time, so every arriving patch turns
into an unplanned design session and the batch is never assembled. Holding the two apart is what makes a pass a
pass.

There is no third ceremony. Every pass after the first is the same operation, and the state that calls for one
is derived rather than judged — see [A fogbound map is reported (ADR 0034)](./0034-a-fogbound-map-is-reported.md).

## Considered options

The method this descends from creates every statable ticket during initial mapping and treats later graduation
as something noticed when a design ticket closes. Tried here, it produced fog patches that duplicated live
tickets almost word for word, because removing a patch at graduation would have dangled the graduating ticket's
own link back to it.

## Consequences

A mapping pass **consumes** the patch it graduates, so a live ticket and a live patch never describe the same
question. That is what leaves nothing for a ticket to point at — see
[Nothing points at a fog patch (ADR 0033)](./0033-nothing-points-at-a-fog-patch.md).

A decision landed during a pass leaves no trail row, because no ticket ever existed. The trail records closed
design tickets and nothing else.

A patch that survives a pass without a stated reason is evidence the pass was not run on it. That is the only
check available on a phase bearing does not observe, and it is a human one.
