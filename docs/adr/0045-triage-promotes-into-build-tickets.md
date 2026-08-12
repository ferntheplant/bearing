# Triage promotes into build tickets

`bearing triage --ticket` writes a build ticket with no project, and `--to <project>` writes a build ticket
attached to the named map; triage never writes a design ticket. The promote verdicts are the cheapest that
fits
([Two ticket types, discriminated by how they close (ADR 0007)](./0007-two-ticket-types-discriminated-by-how-they-close.md)):
a build ticket closes as a commit, so its promotion is complete in one move, while a design ticket is a
question whose answer must land somewhere durable before it can close. A captured finding that is a question
belongs on a map as a design ticket written directly with `bearing add design --project <map>`, after reading
it — not as a triage verdict.

## Consequences

The triage commands differ from one another only in frontmatter: `--ticket` adds `type: build`, `--to
<project>` adds `project` alongside it, and `--drop` deletes. A design ticket is never created by a triage
command, so the catalogue's project-attached verdict names the build half and leaves the design half to
`bearing add`.
