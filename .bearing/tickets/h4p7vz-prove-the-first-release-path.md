---
type: design
project: mvp
---

# Prove the first release path

**What exact path takes bearing from this repository to an installable, provenance-bearing package without
introducing release machinery a single-package project does not need?**

[One published package, and core stays private (ADR 0020)](../../docs/adr/0020-one-published-package-and-core-stays-private.md)
settles the shape: one scoped package exposes the unscoped `bearing` binary, bundles core, and publishes from CI
with registry provenance. Nobody working on bearing has run that path before, so this ticket establishes facts
before build work encodes assumptions about them.

Prove the path far enough to answer:

1. Which exact public package name and scope bearing can claim, and what one-time human registry setup it needs.
2. Which package files, bundled assets, metadata, and runtime constraints appear in the tarball an installer
   actually receives.
3. How a release is versioned and given a changelog and tag without adopting multi-package orchestration by
   accident.
4. Which CI identity, repository settings, and registry trusted-publishing settings produce provenance without a
   long-lived publish token.
5. How the first release differs from later releases, including which steps an agent can perform and which need
   an explicit human handoff.

Use registry and CI documentation plus local package packing; do not publish a placeholder release merely to
answer the question. The result must leave build tickets that are executable without rediscovering setup
mechanics.

Settles as an edit to the setup capability recording the exact installation and release promise. Record an ADR
only for a release-discipline trade-off that meets this repository's ADR test, and record externally imposed
behavior in `docs/gotchas.md` only when it would otherwise look like a defect.
