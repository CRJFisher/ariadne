# Task 11.62.27.5: Complete Type Migration and Fix Compilation Errors

**Status:** Created
**Priority:** High
**Estimated Hours:** 8-12
**Dependencies:** task-epic-11.62.27.4

## Description

Complete the migration to the new consolidated import/export types in @ariadnejs/types. This task addresses the 200+ compilation errors that remain after the initial migration attempt.

## Background

During sub-tasks 11.62.27.1-4, we:
1. Audited all import/export type definitions across the codebase
2. Created consolidated types in @ariadnejs/types with single `symbol_name` field
3. Removed duplicate type definitions from core
4. Began updating consumers to use the new API

However, we discovered fundamental incompatibilities between the old and new type systems that require more extensive refactoring.

## Key Issues to Address

### 1. Type Shape Incompatibilities
- Many types have different field names and structures
- Location type has different fields (file_path, line, column vs row, column)
- TypeInfo has completely different structure

### 2. Missing Type Exports
- Various types are not exported from their modules
- Test files cannot import types they need

### 3. API Breaking Changes
- Changed from `symbol_names` array to single `symbol_name` field
- ImportInfo and ExportInfo have different purposes in different contexts
- Some types were renamed (e.g., ImportInfo → ResolvedImport in import_resolution.ts)

## Acceptance Criteria

- [ ] All TypeScript compilation errors are resolved
- [ ] npm run build succeeds without errors
- [ ] All tests pass
- [ ] No functionality is broken by the type migration
- [ ] Code follows pythonic naming conventions

## Implementation Notes

### Compilation Error Categories

1. **Missing exports** (~50 errors)
   - Add proper exports to module index files
   - Re-export types from @ariadnejs/types where appropriate

2. **Location type incompatibility** (~40 errors)
   - Update code expecting row/column to use line/column
   - Add file_path where missing

3. **TypeInfo structure** (~30 errors)
   - Update TypeInfo usage to match new structure
   - Remove references to removed fields

4. **ImportInfo/ExportInfo usage** (~80 errors)
   - Update all consumers to use correct type shapes
   - Handle different contexts (statements vs resolved imports)

5. **Readonly array issues** (~20 errors)
   - Fix mutable vs readonly array conflicts
   - Update array manipulation code

### Suggested Approach

1. **Fix exports first** - Add all missing exports to unblock other fixes
2. **Create adapter functions** - Bridge old and new type shapes during migration
3. **Update tests** - Fix test compilation errors to enable validation
4. **Refactor incrementally** - Fix one module at a time, testing as you go
5. **Remove adapters** - Once migration is complete, remove temporary adapters

## Testing Requirements

- Run `npm run build` after each module is fixed
- Run `npm test` for affected modules
- Verify no runtime errors in key workflows

## Related Tasks

- Parent: task-epic-11.62.27
- Depends on: task-epic-11.62.27.4
- Blocks: Future import/export system improvements

## Notes

This is a critical refactoring that affects the entire codebase. Take time to do it properly rather than applying quick fixes that may cause issues later.