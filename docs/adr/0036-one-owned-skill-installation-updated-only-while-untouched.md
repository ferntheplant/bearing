# One owned skill installation, updated only while untouched

Bearing recognizes two repository-local skill homes: `.agents/skills` and `.claude/skills`. It resolves symlink
aliases before choosing, writes one physical installation, and remembers that location through a hidden
ownership marker inside the installed skill. On first installation it uses the sole existing convention, asks
the user to choose when both exist at distinct locations, and defaults to `.agents/skills` when neither exists.
Later runs keep using the owned location rather than detecting again or migrating it implicitly.

The ownership marker records the bearing version and a digest of the packaged skill tree. A re-run replaces an
untouched installation with the packaged version. If any installed file was added, removed, or changed, bearing
leaves the entire tree byte-for-byte intact, reports that the update was skipped because the skill is locally
modified, and succeeds. A same-named skill without a valid ownership marker is user-owned: setup refuses before
writing either the tracker or the skill.

One copy avoids independent local edits drifting across agent directories, and whole-tree skipping avoids a
partial merge producing a skill whose instructions and references came from different versions. Writing a
second discoverable skill alongside would preserve the bytes but create two methods with the same purpose.

## Considered options

`skills add` informed the convention and alias model, but not the update model. At version 1.5.22 it recognizes
dozens of agent locations and can fan one canonical copy out through symlinks, while re-adding or updating
removes an existing destination without checking whether its installed contents were edited. Bearing supports
only the two conventions it uses today; expanding that list later is cheaper than shipping and maintaining an
agent registry speculatively.

## Consequences

The marker is installation state, not user configuration. Bearing has no setting for a skill destination and no
command that moves one. If distinct owned installations are found, setup refuses the ambiguity rather than
choosing one.

The first setup prompt is only for two distinct existing conventions. Symlinked aliases such as this repository's
`.claude -> .agents` are one destination and do not prompt.
