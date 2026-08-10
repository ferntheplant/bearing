# One owned skill installation, updated only while untouched

Bearing installs one repository-local skill at the literal path `.agents/skills/bearing-wayfinder`. It does not
inspect or adopt `.claude/skills`, and it never follows a symbolic link while inspecting or mutating the
installation. A symbolic link at `.agents`, `.agents/skills`, or the skill root is a collision; one inside an
owned skill tree makes that tree locally modified. A hidden ownership marker inside the installed skill records
that bearing owns it.

The ownership marker records the bearing version and a digest of the packaged skill tree. A re-run replaces an
untouched installation with the packaged version. If any installed file was added, removed, or changed, bearing
leaves the entire tree byte-for-byte intact, reports that the update was skipped because the skill is locally
modified, and succeeds. A same-named skill without a valid ownership marker is user-owned: setup refuses before
writing either the tracker or the skill.

The `.agents` convention is shared rather than tied to one agent, and a fixed location removes convention
detection and an interactive setup branch. The `bearing-wayfinder` name keeps the installed skill distinct from
other wayfinder methods a repository may already carry. Refusing symlinks keeps that location literal: following
one could redirect bearing's writes outside the repository-owned tree. Whole-tree skipping avoids a partial
merge producing a skill whose instructions and references came from different versions.

## Considered options

`skills add` informed the original convention model, but not the update model. At version 1.5.22 it recognizes
dozens of agent locations and can fan one canonical copy out through symlinks, while re-adding or updating
removes an existing destination without checking whether its installed contents were edited. Bearing instead
chooses one agent-neutral convention and one literal installation.

## Consequences

The marker is installation state, not user configuration. Bearing has no setting for a skill destination, no
command that moves one, and no setup prompt.
