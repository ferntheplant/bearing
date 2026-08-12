---
type: build
project: mvp
---

# Generate shell completions

## Background

[Setup and the shipped skill](../../docs/capabilities/08-setup-and-the-skill.md) promises
`bearing completion <shell>`, and nothing builds it.

This was briefly charted as fog, on the grounds that the surface listing promised it while the acceptance
criteria did not — so it was unclear whether it was in scope at all. That ambiguity was an artifact of the
criteria existing as a third register alongside the capability catalogue. With the catalogue as the whole of
what bearing promises, a capability file promising completion is the commitment, and this is an ordinary build
ticket.

`effect/unstable/cli` exports `Completions`, per [the toolchain gotchas](../../docs/gotchas.md), so this is
wiring rather than generation from scratch — which is also why it waits on `n3dd4b`.

## Scope

Add `bearing completion <shell>`, emitting a completion script on stdout for each shell the framework supports.

Out of scope: installing the script anywhere. Bearing writes to the tracker and to its own skill installation,
and a shell profile is neither.

## Done when

- `bearing completion <shell>` writes a completion script to stdout and exits 0 for every shell named in its own
  help text.
- An unsupported or missing shell argument exits 1 and names the shells that are supported.
- The generated script covers the commands that exist at the time it is generated, with no hand-maintained
  second list of command names.
- The command writes no file and creates nothing.
- Nothing in the generated output names the flag that applies a design close, and `66r5rr`'s check covers this
  output once both have landed.
- `vp run ready` passes from a clean checkout.
