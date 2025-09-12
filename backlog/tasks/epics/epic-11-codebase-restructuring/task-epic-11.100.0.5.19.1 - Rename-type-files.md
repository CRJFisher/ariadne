---
id: task-epic-11.100.0.5.19.1
title: Rename type files from kebab-case to snake_case
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['file-naming', 'cleanup']
dependencies: []
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Rename all the new type files from kebab-case to snake_case to match project conventions.

## Files to Rename

- `unified-call-types.ts` → `call_types.ts`
- `unified-symbol-scope-types.ts` → `symbol_scope_types.ts`
- `unified-import-export-types.ts` → `import_export_types.ts`
- `unified-type-analysis-types.ts` → `type_analysis_types.ts`
- `unified-inheritance-types.ts` → `inheritance_types.ts`
- `base-query-types.ts` → `base_query_types.ts`
- `query-integration-types.ts` → `query_integration_types.ts`
- `type-validation.ts` → `type_validation.ts`
- `branded-types.ts` → (to be deleted after redistribution)

## Acceptance Criteria

- [ ] All type files use snake_case
- [ ] Remove 'unified' prefix from filenames
- [ ] Update all imports in other files
- [ ] Tests still pass