# Task 11.100.0.5.follow-up-1: Fix Critical Type Export Issues

## Context
During the Epic 11 type system refactoring (tasks 11.100.0.5.14-26), several critical type export issues were introduced that are blocking compilation. These must be resolved immediately to unblock development.

## Problem Statement
Multiple modules are failing to compile due to missing or conflicting type exports:
1. `TypeInfo` is not exported from the type_tracking module
2. `ImportInfo` type is missing from @ariadnejs/types package exports
3. Conflict between deprecated ImportInfo/ExportInfo and new Import/Export branded types
4. Several utility types are referenced but not exported

## Acceptance Criteria
- [ ] All TypeScript compilation errors related to missing type exports are resolved
- [ ] The types package exports all required types consistently
- [ ] No conflicts between old and new type systems
- [ ] All modules can import required types without errors
- [ ] Type exports are organized logically in index.ts

## Specific Files to Update

### packages/types/src/index.ts
- Export `TypeInfo` from type_tracking module
- Export `ImportInfo` if still needed, or provide migration path
- Ensure Export and Import branded types are properly exported
- Add any missing utility types identified during compilation

### packages/core/src/type_tracking/index.ts
- Ensure TypeInfo interface is properly exported
- Export any related type tracking utilities

### Resolution Strategy
1. Run `npm run typecheck` to get full list of missing exports
2. Group missing exports by module
3. Add exports systematically, checking for naming conflicts
4. For conflicts between old/new types:
   - If both needed temporarily, use namespace separation
   - If migration complete, remove old types
   - Add type aliases if needed for compatibility

## Testing
- Clean TypeScript compilation with no errors
- All existing tests pass
- Can successfully import all exported types in a test file

## Notes
- This is blocking all other development work
- Coordinate with team if changing public API exports
- Document any breaking changes in CHANGELOG