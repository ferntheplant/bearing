# Bearing installs its own skill

Bearing ships the wayfinder method as a skill inside its own package and writes it into the target repository
during setup. It is not distributed as a separate plugin or marketplace entry.

Owning installation keeps the skill versioned with the tracker it describes. The skill teaches the command
surface, so a skill that ships separately is a skill that eventually teaches a surface that no longer exists.
Shipping both in one package at one version makes that impossible, and it means a repo that adopts bearing gets
the method in the same gesture as the tool.

The method itself is the part neither ancestor skill covers: **resolving one design ticket typically yields a
short ordered run of build tickets**, which is smaller and more frequent than a top-down decomposition and
narrower than a single-feature spec. It takes vertical slicing and one-pass blocker wiring from the first, and
done-when rigor — an assertion someone could check, not an intention — from the second. Those do not compose as
cleanly as they look: decomposition assumes sibling slices of a known feature, where "independently demoable" is
achievable, while clearing fog emits build tickets in unrelated areas. So blockers do more work here, and
demoability is an aspiration for the last slice rather than a rule for every one.

## Consequences

How setup chooses one skill home and updates it without clobbering local edits is settled in
[One owned skill installation, updated only while untouched (ADR 0036)](./0036-one-owned-skill-installation-updated-only-while-untouched.md).

Two constraints the skill inherits from elsewhere: it stops at a ticket someone could pick up and hands off
rather than half-writing a spec
([Bearing stops at the repo's edge (ADR 0014)](./0014-bearing-stops-at-the-repos-edge.md)), and it must never
mention the confirmation flag
([The confirmation flag is undocumented on purpose (ADR 0016)](./0016-the-confirm-flag-is-undocumented-on-purpose.md)).
