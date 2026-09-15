---
"@ariadnejs/core": patch
---

Discard a cached per-file index whenever the indexer that produced it changes.

A cached index was keyed on the package version and a hand-maintained schema
number, so a build that changed what indexing extracts — or the shape a cached
index is written in — without a version bump kept serving indexes the previous
build produced. The call graph silently lost edges: a method called only
through an interface-typed variable could be reported as an unreachable entry
point.

The cache key is now a fingerprint of the indexer build itself: the modules
that parse, index and serialize a file, the `.scm` queries, and the versions of
the tree-sitter packages they load. Any change to them re-indexes on the next
load; changes to resolution, the call graph or classification keep the cache
warm. Existing caches are discarded once.
