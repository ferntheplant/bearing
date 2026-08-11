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
operations; then build mutation planning and ordered apply.

**The whole read path comes before any mutation**, which is a consequence of the same dependency order rather
than a separate decision. Ranking and integrity are the parts most likely to be wrong on the first attempt, and
both are reachable against a hand-written tracker with no mutation code at all — so they can be got wrong
cheaply, against files a human can repair by hand. Mutations are the only part that can damage a tracker, and
integrity therefore precedes them: the command that reports a half-finished apply exists before anything can
leave one behind.

This orders work; it does not scope it. Nothing here removes a goal, and a capability being late in the order
says nothing about whether it ships.

These are dependencies between areas of the implementation, not a decomposition into units of work. A change is
done when it is reachable through a real entrypoint, so a slice that stopped at "analysis" would not be
finishable. Work is cut by command, and each command carries whatever acquisition, analysis, planning, and
applying it needs.
