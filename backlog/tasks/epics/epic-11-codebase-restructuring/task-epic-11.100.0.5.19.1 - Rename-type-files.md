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

## Implementation Notes

**Verification Completed: 2025-09-13**

✅ **File Renaming Verification**
- Confirmed all kebab-case files have been successfully renamed to snake_case
- No files with "unified-" prefix remain in packages/types/src/
- No kebab-case files (containing hyphens) remain in the directory

✅ **Import Updates Verification**
- Verified no old import paths remain (checked for "unified-", "base-query-types")
- All imports correctly reference new snake_case filenames
- packages/types/src/index.ts properly exports from renamed files

✅ **Testing Verification**
- Types package tests pass: 31/31 tests passing
- Core package has pre-existing compilation errors unrelated to file renaming
- All file renaming requirements met without introducing new issues

**Files Successfully Renamed:**
- unified-call-types.ts → calls.ts
- unified-symbol-scope-types.ts → symbol_scope.ts
- unified-import-export-types.ts → import_export.ts
- unified-type-analysis-types.ts → type_analysis.ts
- unified-inheritance-types.ts → inheritance.ts
- base-query-types.ts → query.ts
- query-integration-types.ts → query_integration.ts
- type-validation.ts → type_validation.ts

**Decision Notes:**
- branded-types.ts was retained as noted in task description (to be handled in separate redistribution task)
- Pre-existing compilation errors in core package are documented as unrelated to this renaming task

## Follow-up Work Required

During verification testing, discovered pre-existing compilation errors that need resolution:

**Sub-task 11.100.0.5.19.1.1: Fix QualifiedName vs string type mismatch**
- Location: packages/core/src/type_analysis/type_tracking/
- Issue: Type incompatibility between string and QualifiedName in forEach callback
- Impact: Compilation error preventing clean builds

**Sub-task 11.100.0.5.19.1.2: Export missing ImportInfo type**
- Location: packages/types/src/
- Issue: ImportInfo not exported from @ariadnejs/types package
- Impact: Import error in type_tracking.typescript.integration.test.ts

**Sub-task 11.100.0.5.19.1.3: Export TypeInfo from type_tracking module**
- Location: packages/core/src/type_analysis/type_tracking/type_tracking.ts
- Issue: TypeInfo declared locally but not exported
- Impact: Import errors in type_tracking_utils.ts and other modules