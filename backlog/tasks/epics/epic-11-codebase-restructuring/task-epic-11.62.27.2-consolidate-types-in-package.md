# Task 11.62.27.2: Consolidate Types in @ariadnejs/types Package

**Status**: 🔴 Not Started  
**Assignee**: Unassigned  
**Estimated effort**: 2-3 hours  
**Actual effort**: Not recorded  
**Priority**: P1 (High)  
**Tags**: #types #refactoring #breaking-change

## Context

Sub-task of 11.62.27. Implement the consolidated type design in the @ariadnejs/types package, establishing the single source of truth for import/export types.

## Requirements

1. **Implement consolidated types in @ariadnejs/types**
   - Move ImportInfo and ExportInfo from modules.ts to import_export.ts
   - Update ImportStatement and ExportStatement with `symbol_name?: SymbolName`
   - Add any missing fields identified in the audit
   - Ensure proper readonly modifiers

2. **Deprecate/remove redundant types**
   - Mark types that will be removed for deprecation
   - Update modules.ts to re-export from import_export.ts if needed
   - Clean up any redundant type aliases

3. **Ensure backward compatibility where possible**
   - Keep type aliases for commonly used types
   - Add deprecation notices with migration instructions
   - Consider keeping both `symbol_names` and `symbol_name` temporarily

## Implementation Checklist

- [ ] Create new consolidated ImportInfo interface
- [ ] Create new consolidated ExportInfo interface
- [ ] Update ImportStatement with `symbol_name?: SymbolName`
- [ ] Update ExportStatement with `symbol_name?: SymbolName`
- [ ] Add fields for namespace imports/exports
- [ ] Add fields for type-only imports/exports
- [ ] Add fields for re-exports
- [ ] Add proper JSDoc documentation
- [ ] Add deprecation notices to old types
- [ ] Update package exports in index.ts
- [ ] Build and verify no compilation errors
- [ ] Update package version (major bump)

## Success Criteria

- [ ] Single source of truth for import/export types established
- [ ] All use cases from audit are covered
- [ ] Types are well-documented
- [ ] Package builds successfully
- [ ] Breaking changes are documented

## Dependencies

- Depends on 11.62.27.1 (type audit and design)
- Blocks 11.62.27.3 (removing duplicates from core)

## Notes

This establishes the foundation. Once these types are in place and published, we can update the core package to use them.