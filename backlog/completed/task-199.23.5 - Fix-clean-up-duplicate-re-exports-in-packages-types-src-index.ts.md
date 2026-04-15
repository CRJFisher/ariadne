---
id: TASK-199.23.5
title: "Fix: clean up duplicate re-exports in packages/types/src/index.ts"
status: Done
assignee: []
created_date: "2026-04-15 10:49"
updated_date: "2026-04-15 20:48"
labels:
  - cleanup
  - information-architecture
dependencies: []
references:
  - packages/types/src/index.ts
parent_task_id: TASK-199.23
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/types/src/index.ts` has redundant re-exports: `symbol_definitions` appears to be exported at least twice (lines 68 and 74). Audit the barrel file for all duplicate or unnecessary re-exports and remove them. Verify that removing duplicates does not break any consumers (TypeScript will error at build time if anything is missing).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 No duplicate export statements in packages/types/src/index.ts
- [x] #2 Build and all tests pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Removed all duplicate re-exports from `packages/types/src/index.ts`:

- `export { location_key } from "./common"` (covered by `export * from "./common"`)
- `export { Location, Language } from "./common"` (covered by `export * from "./common"`)
- Named exports from `./calls` (covered by `export * from "./calls"`)
- `export { ModulePath, NamespaceName } from "./import_export"` (covered by `export * from "./import_export"`)
- Second `export * from "./symbol_definitions"` (exact duplicate)
- `export { type TypeInfo } from "./index_single_file"` (covered by `export * from "./index_single_file"`)

Also removed stale/misleading comments. All 82 types package tests pass.

<!-- SECTION:FINAL_SUMMARY:END -->
