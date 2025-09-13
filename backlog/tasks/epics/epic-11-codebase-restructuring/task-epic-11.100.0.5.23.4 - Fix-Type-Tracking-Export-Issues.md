# Task 11.100.0.5.23.4: Fix Type Tracking Export Issues

## Parent Task
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority
**HIGH** - Multiple modules failing to build due to missing exports

## Issue Summary
The type_tracking module has export/import conflicts and type mismatches preventing compilation.

## Root Cause Analysis
1. **Missing TypeInfo Export**: Local TypeInfo type not exported from type_tracking.ts
2. **ImportInfo Missing**: ImportInfo type no longer exported from @ariadnejs/types  
3. **Type Mismatches**: SymbolId vs VariableName conflicts
4. **Map Type Issues**: string keys vs branded type keys in maps

## Build Errors Found
```typescript
// Missing exports
Module '"./type_tracking"' declares 'TypeInfo' locally, but it is not exported
Module '"@ariadnejs/types"' has no exported member 'ImportInfo'

// Type conflicts  
Type 'SymbolId' is not assignable to type 'VariableName'
Type 'Map<string, VariableType>' is not assignable to type 'ReadonlyMap<QualifiedName, VariableType>'
```

## Work Required

### Phase 1: Export Resolution
- [ ] Export local TypeInfo type from type_tracking.ts
- [ ] Check if ImportInfo should be re-added to types package or replaced
- [ ] Update all imports using missing types

### Phase 2: Type Consistency  
- [ ] Resolve SymbolId vs VariableName usage conflicts
- [ ] Update Map key types to use proper branded types
- [ ] Fix QualifiedName vs string type mismatches

### Phase 3: Integration Testing
- [ ] Verify type_tracking builds successfully
- [ ] Verify dependent modules build successfully  
- [ ] Run integration tests for type tracking functionality

## Files to Update
Based on build errors:
- `packages/core/src/type_analysis/type_tracking/type_tracking.ts`
- `packages/core/src/type_analysis/type_tracking/index.ts`
- `packages/core/src/type_analysis/type_tracking/import_type_resolver.ts`
- `packages/core/src/type_analysis/type_tracking/test_utils.ts`
- `packages/core/src/type_analysis/type_tracking/*.ts` (all files using TypeInfo)

## Success Criteria
- ✅ All TypeScript compilation errors resolved in type_tracking module
- ✅ Proper exports available for dependent modules
- ✅ Type safety maintained with branded types
- ✅ No breaking changes to public APIs

## Dependencies
**May require**: Updates to types package if ImportInfo needs to be restored

## Estimated Time
1 day

## Risk Assessment
- **Low-Medium Risk**: Mostly export/import resolution
- **Mitigation**: Start with exports, then fix type mismatches incrementally

## Notes
This issue was uncovered during Symbol Refactor but affects a broader set of modules. Resolution will unblock other type-related refactoring work.