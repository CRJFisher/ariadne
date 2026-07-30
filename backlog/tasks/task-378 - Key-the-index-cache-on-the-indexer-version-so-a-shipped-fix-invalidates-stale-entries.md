---
id: TASK-378
title: "Key the index cache on the indexer version so a shipped fix invalidates stale entries"
status: To Do
assignee: []
created_date: "2026-07-30 14:10"
labels:
  - persistence
  - bug
  - comparative-analysis
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A user with a warm cache does not receive the fixes they upgrade for. Ariadne ships a query-pattern or indexer correction, the user updates, reopens the same project — and every unchanged file replays its pre-fix index from `~/.ariadne`. The call graph and the entry-point list are identical to before the upgrade. The only remedy is deleting the cache directory by hand, and nothing tells the user to.

This is not a performance concern. It makes a shipped correctness fix invisible on exactly the projects it was built for.

## Root cause

`CURRENT_SCHEMA_VERSION = 4` (`packages/core/src/persistence/cache_manifest.ts:13`) guards the cache **format** only — its own doc comment says "Increment when the cache format changes in a way that invalidates existing caches", and the v4 note records a format-shaped reason (a v3 manifest could stamp a tracked blob hash onto an index built from dirty content). `deserialize_manifest` discards the manifest wholesale on a version mismatch (`:46-48`), so the mechanism is sound; it is simply keyed on the wrong thing.

The cached artifact is a `SemanticIndex` — the **output of `build_index_single_file`**, not a neutral transcription of the file. Its content depends on the `.scm` query patterns, the capture handlers, the scope boundary extractors and the definition builders. A cache entry is therefore only valid for the indexer build that produced it, and the current key models none of that. Cache validity today rests on content identity alone: the content hash and the git blob hash both describe the _input_, which is precisely what an indexer fix does not change.

The in-flight work makes this concrete rather than hypothetical: TASK-374 and TASK-375 change what indexing extracts from unchanged source, and TASK-377 changes body-scope attachment for every callable. Each lands as a no-op for warm-cache users.

Graphify namespaces its equivalent cache by the producing version for exactly this reason — `cache/ast/v{package_version}/{sha256}.json`, sweeping sibling version directories on first use (`graphify/cache.py:20-33`, `:64-76`) — while deliberately keying its _semantic_ cache on a prompt fingerprint instead, because versioning that one would re-bill an LLM on every patch release. The distinction worth taking is that the key should name whatever actually determines the output.

## Work plan

1. **Add an indexer-version component to the cache key.** Record it in `CacheManifest` alongside `schema_version` and reject a non-matching manifest in `deserialize_manifest` (`cache_manifest.ts:34-51`), reusing the existing wholesale-discard path. Keep `schema_version` as the separate format guard — the two invalidate on genuinely different axes and collapsing them loses that.
2. **Source the version from the package version**, not a hand-maintained constant. A constant someone must remember to bump is the failure mode this task exists to remove, and every indexer change ships inside a release.
3. **Sweep superseded cache directories on first use** rather than leaving them to accumulate, following `cache.py:64-76`. A user who upgrades repeatedly should not need to know the cache directory exists.
4. **Decide and document the granularity.** Per-project or global — state which in the persistence module doc, since the sweep behaviour follows from it.

## Tests

- A manifest written under one indexer version is rejected under another, and every file re-indexes. Assert on the _re-indexed result_, not just the rejection: the test should show a changed indexer producing changed output through a warm cache.
- A manifest under a matching indexer version but a stale `schema_version` is still rejected — the two guards remain independent.
- Superseded version directories are removed on first use, and the current one survives.
- `persistence/*.test.ts` and the cache-restore paths in `project/project.test.ts` stay green.

## Provenance

Identified by comparing Ariadne against Graphify (`~/workspace/tools/graphify`). Every citation verified against source on 2026-07-30.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The cache key includes an indexer-version component sourced from the package version, and `deserialize_manifest` rejects a manifest whose indexer version does not match the running build.
- [ ] #2 `schema_version` remains a separate format guard; a mismatch on either axis independently discards the manifest.
- [ ] #3 Superseded cache directories are removed on first use, and the current one is retained.
- [ ] #4 A test proves the user-visible effect: with a warm cache and unchanged source, a change to indexing produces changed output rather than replaying the stale index.
- [ ] #5 The chosen cache granularity (per-project or global) is stated in the persistence module documentation.
- [ ] #6 `persistence/*.test.ts` and the cache-restore paths in `project/project.test.ts` stay green.

<!-- AC:END -->
