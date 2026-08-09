# Delete the empty apps workspace

`apps/` is empty and there is never going to be an application here — only a library and a shell around it, per
[One published package, and core stays private (ADR 0020)](../../docs/adr/0020-one-published-package-and-core-stays-private.md).
`packages/` is also empty, but that one is about to be used.

Deleting the directory alone does nothing, since git does not track empty directories. The change is two lines:
the `apps/*` entry in `package.json`'s workspaces and the `apps/**/*.ts` entry in `tsconfig.json`'s include.

Found while consolidating the design docs. Nobody has committed to it and it does not block the first slice.
