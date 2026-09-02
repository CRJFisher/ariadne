---
"@ariadnejs/core": minor
"@ariadnejs/types": minor
---

Attribute a call through an interface-typed binding to the implementation that runs.

A method called on a binding destructured from a typed source
(`const { storage } = options; storage.sweep()`) now resolves to the property's
declared type, so the implementation the call reaches gains an incoming edge
instead of surfacing as dead code. The indexer records the source identifier and
property key on the binding (`destructured_from` / `destructured_key`), and
receiver resolution types the binding with one property hop off the source's
type.

A call on an interface-typed receiver now also records an edge to the interface
member the call names, alongside every implementation, so the call graph holds
the dispatch as the source wrote it rather than only as it runs. The interface
member has no body scope, so it is never a call-graph node and the change is
additive: attributions are added, never moved, and entry-point detection still
reaches every implementation.

`VariableDefinition` gains the two provenance fields. The cache entry's
validity is stamped with the package version, so this release's bump is what
retires blobs written by the previous indexer and re-indexes each file once.
