# Task 11.62.27.3: Remove Duplicate Types from packages/core

**Status**: 🔴 Not Started  
**Assignee**: Unassigned  
**Estimated effort**: 3-4 hours  
**Actual effort**: Not recorded  
**Priority**: P1 (High)  
**Tags**: #types #refactoring #cleanup

## Context

Sub-task of 11.62.27. Remove all duplicate import/export type definitions from packages/core and update references to use the consolidated types from @ariadnejs/types.

## Requirements

1. **Remove duplicate type definitions**
   - Delete local ExportInfo from export_detection/export_detection.ts
   - Delete local ImportInfo from import_resolution/import_resolution.ts
   - Delete ImportedClassInfo from type_tracking/type_tracking.ts
   - Delete ModuleImportInfo from module_graph/module_graph.ts
   - Delete local ImportInfo from constructor_type_resolver.ts
   - Clean up any other duplicate definitions found

2. **Update all imports**
   - Change all imports to use @ariadnejs/types
   - Fix any type mismatches
   - Update type assertions where needed

3. **Handle special cases**
   - Keep RustExportInfo but make it properly extend ExportInfo
   - Preserve language-specific extensions
   - Merge helper types appropriately

## Files to Modify

### Primary Files with Duplicates:
- `import_export/export_detection/export_detection.ts`
- `import_export/import_resolution/import_resolution.ts`
- `import_export/module_graph/module_graph.ts`
- `type_analysis/type_tracking/type_tracking.ts`
- `import_export/namespace_resolution/namespace_resolution.ts`
- `call_graph/constructor_calls/constructor_type_resolver.ts`
- `import_export/export_detection/export_detection.rust.ts`

### Files That Import These Types:
- All files in `import_export/` directory
- All test files
- Type adapters
- Code graph builder

## Implementation Checklist

- [ ] Remove ExportInfo from export_detection.ts
- [ ] Remove ImportInfo from import_resolution.ts
- [ ] Remove ImportedClassInfo from type_tracking.ts
- [ ] Remove ModuleImportInfo from module_graph.ts
- [ ] Remove ImportInfo from constructor_type_resolver.ts
- [ ] Update RustExportInfo to extend canonical ExportInfo
- [ ] Update all import statements
- [ ] Fix type mismatches in function signatures
- [ ] Update type adapters if needed
- [ ] Run TypeScript compiler to catch all errors
- [ ] Fix all compilation errors
- [ ] Run tests to ensure functionality preserved

## Success Criteria

- [ ] No duplicate type definitions remain
- [ ] All code uses types from @ariadnejs/types
- [ ] TypeScript compilation succeeds
- [ ] All tests pass
- [ ] No functionality lost

## Dependencies

- Depends on 11.62.27.2 (consolidated types in package)
- Blocks 11.62.27.4 (update consumers)

## Risks

- Type mismatches may require additional adapter functions
- Some internal types may have fields not in the consolidated version
- Tests may need significant updates

## Notes

This is the most risky phase as it touches many files. Should be done carefully with frequent compilation checks.