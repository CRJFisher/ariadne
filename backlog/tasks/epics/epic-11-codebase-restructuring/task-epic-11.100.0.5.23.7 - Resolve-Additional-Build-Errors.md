# Task 11.100.0.5.23.7: Resolve Additional Build Errors

## Parent Task
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority
**MEDIUM** - Clean up remaining compilation errors not covered by other sub-tasks

## Issue Summary
Multiple modules have build errors related to string vs SymbolId type mismatches and other issues uncovered during the Symbol Refactor, but not addressed by the main sub-tasks.

## Build Errors Observed

### File Analyzer Issues
```
src/file_analyzer.ts(XX): Type conflicts with SymbolId usage
```

### Export Detection Issues  
```
src/import_export/export_detection/export_detection.typescript.ts
src/import_export/export_detection/export_extraction.ts
```

### Type Registry Issues
```
src/type_analysis/type_registry/type_registry.ts: 
- TypeName[] vs SymbolId[] conflicts
- Readonly array conversion issues
```

### Import Resolution Issues
```
src/import_export/import_resolution/import_extraction.ts
src/import_export/import_resolution/import_resolution.ts
- Missing export member errors
```

### Module Graph Issues
```
src/import_export/module_graph/module_graph.ts
- Type mismatches in module handling
```

### Namespace Resolution Issues  
```
src/import_export/namespace_resolution/namespace_resolution.ts
- Namespace type conflicts
```

## Work Required

### Phase 1: Error Categorization
- [ ] Catalog all remaining build errors by category:
  - Missing export/import issues
  - String vs SymbolId type conflicts  
  - Array mutability issues (readonly vs mutable)
  - Branded type mismatches

### Phase 2: Export/Import Resolution
- [ ] Fix missing export member errors
- [ ] Update import statements for renamed/moved types
- [ ] Resolve module dependency issues

### Phase 3: Type Consistency Updates  
- [ ] Apply SymbolId casting where needed
- [ ] Fix readonly array vs mutable array conflicts
- [ ] Resolve branded type mismatches (TypeName vs SymbolId, etc.)

### Phase 4: Integration Testing
- [ ] Verify each module builds independently
- [ ] Run integration tests to ensure modules work together
- [ ] Check for any remaining type safety issues

## Methodology
Use the same proven approaches from the main Symbol Refactor task:
- Add type casts where string-to-SymbolId conversion is needed
- Use branded type casting for related types  
- Add overloads for backward compatibility where needed
- Fix imports/exports based on type package updates

## Success Criteria  
- ✅ Core package builds successfully with no TypeScript errors
- ✅ All modules compile without type conflicts
- ✅ No regression in functionality
- ✅ Type safety maintained or improved

## Files to Update
**Based on observed errors**:
- `packages/core/src/file_analyzer.ts`
- `packages/core/src/import_export/export_detection/export_detection.typescript.ts`  
- `packages/core/src/import_export/export_detection/export_extraction.ts`
- `packages/core/src/import_export/import_resolution/import_extraction.ts`
- `packages/core/src/import_export/import_resolution/import_resolution.ts`
- `packages/core/src/import_export/module_graph/module_graph.ts`
- `packages/core/src/import_export/namespace_resolution/namespace_resolution.ts`
- `packages/core/src/type_analysis/type_registry/type_registry.ts`
- `packages/core/src/inheritance/class_hierarchy/class_hierarchy.javascript.ts`

**Additional files may be discovered during Phase 1 error cataloging**

## Dependencies
**Should be done after**:
- Task 11.100.0.5.23.3 (Call Chain Analysis Refactor)
- Task 11.100.0.5.23.4 (Type Tracking Export Issues)

## Estimated Time  
3-4 days (depends on number of errors found)

## Risk Assessment
- **Low-Medium Risk**: Similar to work already completed successfully
- **Mitigation**: Use proven patterns, fix incrementally, test after each change

## Notes
This task is the "cleanup" phase of the Symbol Refactor work. It applies the same techniques used successfully in the main refactor to the remaining modules that have similar issues.

The errors are largely mechanical and should be straightforward to fix using the patterns established in the parent task. Priority should be given to errors that block the overall build.

## Testing Strategy
- Fix errors by module/area to minimize scope
- Test each module's build after fixing its errors  
- Run integration tests after all modules are fixed
- Use the same test approach as the parent task