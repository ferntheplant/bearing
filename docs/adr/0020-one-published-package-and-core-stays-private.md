# One published package, and core stays private

Bearing publishes exactly one package, exposing one binary. The domain package stays private to the workspace
and is bundled into the CLI at build time.

That is a deliberate narrowing from a first draft that had the domain published as a library. Publishing a
library with no external consumer is a maintenance surface bought on speculation: a version number to bump, a
public API to avoid breaking, and semantic-versioning obligations to a second interface that does not exist.
The seam in [Core returns values; only the CLI renders (ADR 0019)](./0019-core-returns-values-only-the-cli-renders.md)
is what makes that second interface cheap, and it is a code-organization property that holds whether or not the
domain has its own registry entry. If something ever wants the domain separately, publishing it then is a small
change; un-publishing is not.

The package name is scoped even though the binary is not. The bare name is taken on the registry, but **the
binary name is independent of the package name**, so the command is `bearing` regardless of what the tarball is
called — and a personal scope is the better answer anyway: one namespace for all these tools, no per-project
name hunt, and no competing with whoever holds a common English word.

## Consequences

The repository holds a library and a shell around it, plus the skills the CLI installs. The shell is the one
thing that ships, so it lives in `apps/cli` and the domain stays private in `packages/core` — the directory
split tracks deployability, and the publishing decision above is what makes it a one-package release either
way.

Release mechanics stay simple because only one package publishes: a changelog discipline and a tag, published
from CI with registry provenance, rather than a multi-package release orchestration.
