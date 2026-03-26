---
id: TASK-195.7
title: >-
  Persistence test suite — golden invariant, corruption, staleness,
  property-based, benchmarks
status: To Do
assignee: []
created_date: '2026-03-26 11:04'
labels: []
dependencies:
  - TASK-195.6
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The comprehensive test suite that proves persistence correctness. This is the most important subtask — it validates that statefulness does not corrupt results.

**Golden invariant tests**: For multi-file TS/Python/JS projects, `fresh_project.get_call_graph()` deep-equals `cached_project.get_call_graph()`. Shared `assert_projects_equivalent(a, b)` helper compares call graphs, stats, definitions, resolutions.

**Staleness tests**: cache hit (unchanged file), cache miss (changed file), deleted file, new file, dependent chain (A imports B, B changes, A re-resolved).

**Corruption tests**: truncated JSON, invalid JSON, version mismatch, empty cache, missing entries — all produce correct results via fallback.

**Incremental consistency tests**: partial cache load + re-parse produces identical results to full rebuild. Scenarios: add export, remove definition, change class hierarchy, rename function.

**Property-based tests (fast-check)**: round-trip identity for SemanticIndex; cold/warm equivalence for generated file sets.

**Performance benchmarks**: extend `project.bench.test.ts` with warm start vs cold start comparison. Warm start must be demonstrably faster.

Location: `packages/core/src/persistence/persistence.test.ts` (unit/integration), `packages/core/src/persistence/persistence.property.test.ts` (fast-check), `packages/core/src/persistence/persistence.bench.test.ts` (benchmarks).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Golden invariant: fresh === cached call graph for at least 3 multi-file scenarios (TS, Python, JS)
- [ ] #2 Staleness: 5 scenarios tested (unchanged, changed, deleted, added, dependent chain)
- [ ] #3 Corruption: 5 failure modes tested (truncated, invalid, version mismatch, empty, missing entries)
- [ ] #4 Incremental: 4 mutation scenarios tested (add export, remove def, change hierarchy, rename)
- [ ] #5 Property-based: round-trip identity and cold/warm equivalence via fast-check
- [ ] #6 Benchmarks: warm start timing vs cold start timing reported
- [ ] #7 All tests pass
<!-- AC:END -->
