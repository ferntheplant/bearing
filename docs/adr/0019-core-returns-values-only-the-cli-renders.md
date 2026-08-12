# Core returns values; only the CLI renders

The domain lives in one package that knows nothing about terminals, colour, or strings-as-output. The CLI is the
only thing that turns a value into text. Closing a design ticket does not print a dry run — it returns a plan
holding the ticket, the trail row it found, the tickets it would unblock, and the edits it would make. The CLI
renders that as the dry-run text, JSON output serializes the same value, and a future non-terminal interface
would return it directly.

This is the seam that makes the separation real rather than two folders that drift into one, and the design
already depends on it in three places:

- **JSON output on every read** is nearly free if rendering is the last step, and a permanent tax if it is not.
  The failure mode is a second code path that formats JSON separately and gradually disagrees with the human
  output.
- **Planning and applying** are separate operations for every mutation. Direct mutations run both in one
  invocation; a design close exposes the split as its dry run and re-run. See
  [Only design-ticket closing is a dry run (ADR 0029)](./0029-only-design-ticket-closing-is-a-dry-run.md).
- **Testing.** The domain against an in-memory filesystem needs no temporary directories and no subprocesses.

## Consequences

The Bun implementations of the filesystem, path, and clock services are supplied by the CLI at its entry point,
so the domain package names only the abstract services.

The seam also confines the beta CLI framework to one package, which is what turns an upstream API break into a
diff in one directory — see
[Effect's unstable CLI, pinned exactly and confined to one package (ADR 0022)](./0022-effects-unstable-cli-pinned-exactly-and-confined.md).
