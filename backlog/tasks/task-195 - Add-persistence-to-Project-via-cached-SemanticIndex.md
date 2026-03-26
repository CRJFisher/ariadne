---
id: TASK-195
title: Add persistence to Project via cached SemanticIndex
status: To Do
assignee: []
created_date: "2026-03-26 11:01"
labels:
  - persistence
  - architecture
dependencies: []
references:
  - packages/core/src/project/project.ts
  - packages/core/src/project/load_project.ts
  - packages/core/tests/fixtures/index_single_file_json.ts
  - packages/core/src/index_single_file/index_single_file.ts
  - packages/core/src/index.ts
  - packages/core/src/project/project.bench.test.ts
  - >-
    backlog/archive/tasks/task-100.12 -
    Refactor-Project-class-to-be-immutable-with-pluggable-storage.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Enable users to pass a storage implementation to `load_project()` so that per-file `SemanticIndex` data is persisted across sessions. On warm start, files whose content has not changed skip tree-sitter parsing entirely — the cached `SemanticIndex` is fed directly into registry updates and resolution.

### Why

Re-indexing a large codebase from scratch on every startup is the dominant cost. Tree-sitter parsing + 4-pass indexing accounts for the bulk of `update_file()` time. By persisting the `SemanticIndex` output per file and detecting unchanged files via content hashing, warm starts skip the expensive parse phase entirely while still rebuilding registries and resolution from the cached indexes (which is fast).

### Architecture

**Cache at the SemanticIndex level, not the registry level.** The 7 registries (DefinitionRegistry, TypeRegistry, ScopeRegistry, ExportRegistry, ReferenceRegistry, ImportGraph, ResolutionRegistry) are all derived from SemanticIndex data via `update_file()`. Persisting them would require serializing cross-registry references (TypeRegistry holds a live DefinitionRegistry pointer), deeply nested Maps (DefinitionRegistry has 3-level nesting in `scope_to_definitions_index`), and would couple the cache format to internal registry structure. Instead, persist only the SemanticIndex per file and replay the registry update pipeline on load — this is fast, correct, and forward-compatible with logic changes.

**Invalidation via SHA-256 content hashing.** Each cached file entry stores a content hash. On warm start, files are hashed and compared. Unchanged files use cached SemanticIndex; changed/new files go through full `update_file()`. Deleted files are skipped. No mtime (unreliable across git operations and platforms).

**Schema version integer.** A single `CURRENT_SCHEMA_VERSION` constant. On load, if the version doesn't match, the entire cache is discarded. No migrations — just re-index from scratch. The version bumps when any serialized type changes (SemanticIndex fields, definition types, reference types, LexicalScope shape).

### Key Design Decisions

1. **`restore_file()` method on Project** — accepts a pre-computed SemanticIndex and runs only Phases 2-5 of `update_file()` (registry updates + resolution), skipping Phase 1 (tree-sitter parse + `build_index_single_file`). This is the core architectural change — it factors `update_file()` into parse vs registry-update phases.

2. **`PersistenceStorage` interface** — minimal async interface that users implement:

   - `read_index(file_path): Promise&lt;string | null&gt;`
   - `write_index(file_path, data): Promise&lt;void&gt;`
   - `read_manifest(): Promise&lt;string | null&gt;`
   - `write_manifest(data): Promise&lt;void&gt;`
   - `clear(): Promise&lt;void&gt;`
     A built-in `FileSystemStorage` implementation writes to a `.ariadne-cache/` directory using atomic write-to-temp-then-rename.

3. **`LoadProjectOptions.storage?: PersistenceStorage`** — optional parameter. Without it, behavior is identical to today. With it, `load_project()` checks the cache before parsing each file.

4. **Explicit `project.save()`** — no auto-save. The caller decides when to persist (after initial load, on shutdown, etc.).

5. **Error recovery: always fall back to full re-index.** Corrupted cache, invalid JSON, version mismatch, missing entries — all produce a warning log and proceed as if no cache existed. No partial recovery, no repair.

### Warm Start Flow

```
load_project(options with storage):
  1. project.initialize() — rebuild FileSystemFolder from live filesystem
  2. Discover source files on disk
  3. Load cache manifest from storage
  4. For each file on disk:
     a. Compute SHA-256 content hash
     b. If hash matches cached entry: project.restore_file(path, content, cached_index)
     c. If hash differs or no cache: project.update_file(path, content)
  5. For cached files not on disk: skip (file was deleted)
  6. Save updated manifest + any newly cached indexes via storage
  7. Return project
```

### Serialization Details

All SemanticIndex fields are fully JSON-serializable — branded strings (`SymbolId`, `ScopeId`, `FilePath`), plain data interfaces (`FunctionDefinition`, `ClassDefinition`, etc.), `ReadonlyMap` (serialize as `[key, value][]` arrays), and `readonly T[]` (serialize as JSON arrays). No tree-sitter objects (the `Parser.Tree` is transient, consumed during `build_index_single_file()` and never stored in SemanticIndex). Existing precedent: `tests/fixtures/index_single_file_json.ts` already round-trips SemanticIndex through JSON.

### Testing Strategy

Persistence introduces statefulness into a stateless system. The testing approach goes beyond standard unit tests:

**A. Golden Invariant Tests** — the cornerstone. For any set of source files: `fresh_project.get_call_graph() === cached_project.get_call_graph()`. This must hold for every language, every multi-file scenario, and every incremental update case. A shared `assert_projects_equivalent(a, b)` helper compares call graphs, stats, definitions, and resolutions.

**B. Round-trip Serialization Tests** — `deserialize(serialize(index)) === index` for SemanticIndex covering all languages and definition types. Extends the existing `index_single_file_json.test.ts` pattern.

**C. Staleness Detection Tests** — file unchanged (cache hit), file changed (cache miss + re-index), file deleted (skip), file added (full index), dependent chain (file A imports B, B changes, A gets re-resolved).

**D. Corruption/Recovery Tests** — truncated JSON, invalid JSON, version mismatch, empty cache, missing entries — all fall back to full re-index without error, producing identical results to cold start.

**E. Incremental Consistency Tests** — after partial update (some files from cache, some re-parsed), all registries are internally coherent. Tests: add export, remove definition, change class hierarchy, rename function — each verified against fresh rebuild.

**F. Property-Based Tests (fast-check)** — round-trip identity for arbitrary SemanticIndex; cold/warm equivalence for generated file sets; idempotency of re-indexing.

**G. Storage Contract Tests** — parameterized test suite that any `PersistenceStorage` implementation must pass: round-trip, missing key returns null, clear removes everything.

**H. Performance Benchmarks** — extend `project.bench.test.ts`: serialization throughput, deserialization throughput, cache-hit vs full-rebuild comparison, staleness detection overhead. The warm start must be demonstrably faster than cold start.

### Prior Art

Task-100.12 (archived) attempted a full pluggable storage layer with registry serialization, service extraction, and immutability. It was completed, migrated (epic-11.28-31), then entirely deleted in commit `6fee1779`. The current approach is fundamentally different: it caches only the expensive-to-compute SemanticIndex, keeps the Project class unchanged except for `restore_file()`, and avoids serializing derived registry state. This is narrower, simpler, and decoupled from internal registry structure.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 PersistenceStorage interface defined with async read/write methods for per-file index data and manifest
- [ ] #2 FileSystemStorage implementation using atomic write-to-temp-then-rename
- [ ] #3 SemanticIndex JSON serialization/deserialization using Map-to-entries pattern (extends existing index_single_file_json.ts precedent)
- [ ] #4 SHA-256 content hashing for cache invalidation — unchanged files skip tree-sitter parsing
- [ ] #5 Schema version integer with discard-on-mismatch (no migrations)
- [ ] #6 Project.restore_file() method that accepts pre-computed SemanticIndex and runs only registry updates + resolution (Phases 2-5 of update_file)
- [ ] #7 LoadProjectOptions gains optional storage parameter — without it, behavior is identical to current
- [ ] #8 Project.save() method for explicit persistence — no auto-save
- [ ] #9 Error recovery: corrupted/invalid/outdated cache falls back to full re-index with warning log
- [ ] #10 Golden invariant test suite: fresh_project.get_call_graph() deep-equals cached_project.get_call_graph() for multi-file TS/Python/JS scenarios
- [ ] #11 Round-trip serialization tests for SemanticIndex covering all languages and definition types
- [ ] #12 Staleness detection tests: cache hit, cache miss, file deleted, file added, dependent re-resolution
- [ ] #13 Corruption recovery tests: truncated JSON, invalid JSON, version mismatch all produce correct results via fallback
- [ ] #14 Incremental consistency tests: partial cache load + re-parse produces identical results to full rebuild
- [ ] #15 Property-based tests (fast-check): round-trip identity and cold/warm equivalence
- [ ] #16 Storage contract test suite parameterized for any PersistenceStorage implementation
- [ ] #17 Performance benchmarks in project.bench.test.ts: warm start demonstrably faster than cold start
- [ ] #18 Public API exports: PersistenceStorage interface and FileSystemStorage class from packages/core/src/index.ts
<!-- AC:END -->
