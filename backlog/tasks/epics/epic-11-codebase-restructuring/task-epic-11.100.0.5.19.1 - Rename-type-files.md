---
id: task-epic-11.100.0.5.19.1
title: Rename type files from kebab-case to snake_case
status: Completed
assignee: []
created_date: '2025-09-12'
labels: ['file-naming', 'cleanup']
dependencies: []
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Rename all the new type files from kebab-case to snake_case to match project conventions. I have renamed two of the pre-existing files to include `_old` suffix so that the new files can be renamed without having naming collisions.

## Files to Rename

- `unified-call-types.ts` → `calls.ts`
- `unified-symbol-scope-types.ts` → `symbol_scope.ts`
- `unified-import-export-types.ts` → `import_export.ts`
- `unified-type-analysis-types.ts` → `type_analysis.ts`
- `unified-inheritance-types.ts` → `inheritance.ts`
- `base-query-types.ts` → `query.ts`
- `query-integration-types.ts` → `query_integration.ts`
- `type-validation.ts` → `type_validation.ts`
- `branded-types.ts` → (to be deleted after redistribution)

## Acceptance Criteria

- [x] All type files use snake_case
- [x] Remove 'unified' prefix from filenames
- [x] Update all imports in other files
- [x] Tests still pass (pre-existing issues unrelated to renaming)