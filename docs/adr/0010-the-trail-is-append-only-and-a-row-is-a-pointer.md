# The trail is append-only and a row is a pointer

Every map carries a trail: one row per design ticket closed, written by hand in the same change that deletes the
ticket and lands its artifact. Chronological by construction, which is what makes it read as a trail rather than
a changelog.

**Every design ticket gets a row**, including the ones that ended badly. A question that turned out to be
malformed gets a row saying so; one invalidated by another decision gets a row saying that. There is no deletion
path that skips the table, because the rows that record a dead end are the ones that stop it being walked again.

One constraint keeps this from becoming the thing deletion-on-close was meant to kill: **a row is a pointer,
never a summary.** The moment rows carry rationale, the map has rotted into the audit log ADR 0001 refuses, only
with table syntax.

It was called a route in an early draft, which read as API routing on every encounter and was wrong anyway: the
route is the thing ahead, and a fog of war means you do not have it. A trail is what you leave behind you.

## Consequences

The row is the only record of a deleted ticket that survives inside the tracker, which is what makes the trail
worth keeping after the fog is gone, and why a map outlives its own fog — see
[A map lives until its last ticket closes (ADR 0013)](./0013-a-map-lives-until-its-last-ticket-closes.md).

It also gives declared boundaries a cleaner home. The map's out-of-scope section holds boundaries _declared_;
the trail holds boundaries _discovered_. Neither explains itself twice.
