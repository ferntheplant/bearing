---
type: build
project: mvp
---

# Assert in CI that nothing shipped names the applying flag

## Background

[The confirmation flag is undocumented on purpose (ADR 0016)](../../docs/adr/0016-the-confirm-flag-is-undocumented-on-purpose.md)
ends by requiring exactly this: "CI greps the shipped skill and the generated help output for the flag and fails
if it appears. The test's failure message has to explain why, not just assert." No such check exists. `vp run
ready` runs format, lint, type check, test, and build, and none of them looks at this.

It is written as its own ticket rather than folded into the design-close ticket because it guards artifacts
neither of them owns — the skill's text and every command's help output — and because `x8bq3t` asserts this
check passes, so it has to exist before the skill's text can be called done.

The guard is worth having before the flag is implemented. It fails on the day someone helpfully documents it,
which is six months from now and is the failure the ADR is actually worried about.

## Scope

Add a check to `vp run ready` and therefore to CI that greps the shipped skill tree and every command's generated
help output for the flag, and fails naming the file and the reason. The flag's spelling is settled and recorded
in [The confirmation flag is undocumented on purpose (ADR 0016)](../../docs/adr/0016-the-confirm-flag-is-undocumented-on-purpose.md),
and this check reads the spelling from one place rather than hardcoding it in two.

Out of scope: greping error messages at rest — those are asserted by the tests that produce them, in the tickets
that write them.

## Done when

- The check runs inside `vp run ready` and fails the CI job when it fires.
- It greps `skills/bearing-wayfinder` in full, not only `SKILL.md`.
- It greps the help output of every command the binary exposes, obtained by invoking the built binary rather
  than by reading source.
- Deliberately inserting the flag into the shipped skill makes the check fail, and that case is covered by a
  test.
- The failure message explains why the flag must not appear, citing the mechanism rather than only asserting.
- The check names the flag in exactly one place, and that place is not itself shipped.
- `vp run ready` passes from a clean checkout.
