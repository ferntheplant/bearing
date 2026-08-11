# Ids are minted from the clock, not a random source

An id is six characters of lowercased Crockford base32
([The filename is the only place an id appears (ADR 0006)](./0006-the-filename-is-the-only-place-an-id-appears.md),
[Three frontmatter fields, and the body is prose (ADR 0024)](./0024-three-frontmatter-fields-and-the-body-is-prose.md)),
minted when an item is created and never reused. Minting reads the clock: the low 30 bits of the current
wall-clock nanoseconds, encoded as Crockford base32, checked against the ids already in the tracker, and read
again when the candidate is taken.

The obvious tool is a cryptographic random generator, and the reason it is not used is the domain's service list:
the domain depends on a filesystem, a path implementation, and a clock, and nothing else
([Core exposes operations, not tracker internals (ADR 0027)](./0027-core-exposes-operations-not-tracker-internals.md)).
Admitting a random source would extend that list for a value that is a handle typed at a shell, never a secret.
The clock is already a dependency, and its weakness is self-correcting: the low 30 bits repeat within a ~1.07
second window, so the check-and-retry against the tracker is what makes a minted id fresh — the entropy source
is not what guarantees uniqueness.

## Consequences

A plan refuses a candidate only when the collision is visible in the observation it was planned against. Two
captures racing in the same instant can both mint the same id and write it; the duplicate then makes every
resolution of that id ambiguous rather than silently choosing one, which is the tolerated-race story in
[`ABSTRACT.md`](../../ABSTRACT.md) §5. A capture that follows one into the tracker retries until the clock offers
a value no tracker holds. Minting is deterministic against a scripted clock, which is how the rule that no minted
id matches an id already on disk is tested.
