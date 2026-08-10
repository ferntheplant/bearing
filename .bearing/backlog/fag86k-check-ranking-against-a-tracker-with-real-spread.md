# Check ranking against a tracker with real spread

Ranking is transitive gate count and nothing else. It has never been run against a tracker with enough spread to
produce an order anyone could agree or disagree with.

**The first observation is already in.** The five tickets this tracker opened with have no blockers between
them, so every gate count is zero and `bearing next` would have no order to show at all. That is not a defect in
the ranking; it is what a map looks like before anything on it has been walked. But it is precisely the moment
someone most wants to be told what to do first, and the ranking has nothing to say. Worth knowing whether that
persists.

This got sharper when the fog term was removed
([Nothing points at a fog patch (ADR 0033)](../../docs/adr/0033-nothing-points-at-a-fog-patch.md)). DECIDE's
whole order now rests on the blockers wired in the second sweep of a mapping pass, so the question is no longer
"does gate count plus fog agree with a person" but "does a freshly wired batch produce any order at all".

Two things to look at once there is spread: whether gate count alone produces an order a person actually agrees
with, and what the tiebreaker should be when it does not — the arbitrary order that ships in the meantime is a
placeholder, not a decision.

Nobody has committed to it, and it cannot be worked until a tracker with real spread exists.
