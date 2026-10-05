---
id: TASK-195.1
title: Map/Set JSON serialization utilities
status: To Do
assignee: []
created_date: "2026-03-26 11:02"
labels: []
dependencies: []
parent_task_id: TASK-195
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Create pure utility functions for serializing `Map`, `ReadonlyMap`, and `Set` to/from JSON. These are the building blocks for all subsequent serialization work.

Functions: `serialize_map()`, `deserialize_map()`, `serialize_set()`, `deserialize_set()`. Maps serialize as `[key, value][]` arrays. Sets serialize as `T[]` arrays. All branded string types (`SymbolId`, `ScopeId`, `FilePath`, etc.) are plain strings at runtime and need no special handling.

Location: `packages/core/src/persistence/json_utils.ts` with co-located `json_utils.test.ts`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 serialize_map/deserialize_map round-trips Map<string, T> and nested Map<string, Map<string, T>> losslessly
- [ ] #2 serialize_set/deserialize_set round-trips Set<string> losslessly
- [ ] #3 Handles empty Maps and Sets
- [ ] #4 Handles branded string types (SymbolId, FilePath, etc.) as plain strings
- [ ] #5 Co-located unit tests in json_utils.test.ts
<!-- AC:END -->
