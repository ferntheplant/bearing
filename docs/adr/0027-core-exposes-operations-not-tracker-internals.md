# Core exposes operations, not tracker internals

Core presents one deep, command-shaped interface: a caller asks for a domain read, a mutation plan, or an apply
and receives a structured value. It does not expose a loaded tracker, a general query interface, parsers,
indexes, or the blocking graph for callers to compose. Those would make every caller learn which malformed
documents and derived values are safe for each operation, moving tracker knowledge out through the seam.

Every tracker operation acquires the three directories once into a private, immutable, lossless observation. It
retains exact source text, parsed domain values, source locations, and syntax diagnostics. Filesystem failures
fail acquisition; malformed documents remain evidence so the integrity pass can accumulate findings and
mutation plans can preserve prose and trail rows byte-for-byte. Every other operation refuses a malformed
tracker rather than silently omitting a document.

## Consequences

The implementation has four internal areas in dependency order, not four interfaces callers compose:

1. **Acquisition** owns identity and slug rules, filename and document parsing, exact source, diagnostics, and
   the one-pass filesystem read. The current ticket reader deepens into this rather than gaining peer readers.
2. **Analysis** builds private indexes and derives prefix resolution, fog matching, the blocker graph, integrity
   findings, and the frontier in process.
3. **Planning** turns a mutation request plus the observation into a plan, including lossless rewrites and the
   order in which edits must apply.
4. **Applying** executes a plan through the filesystem seam without rollback and never writes a map.

The build order follows those dependencies: migrate the existing ticket list while deepening acquisition; add
backlog and map parsing plus indexes; build blocker and fog analysis, the integrity pass, and the remaining read
operations; then build mutation planning and ordered apply. Integrity therefore precedes destructive mutations,
as the read-path-first order already requires.
