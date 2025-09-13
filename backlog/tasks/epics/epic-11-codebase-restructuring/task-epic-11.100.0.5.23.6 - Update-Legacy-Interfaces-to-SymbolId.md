# Task 11.100.0.5.23.6: Update Legacy Interfaces to SymbolId

## Parent Task
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority  
**LOW-MEDIUM** - Important for type safety completion but not blocking builds

## Issue Summary
Several legacy interfaces still use raw strings for symbol identifiers instead of SymbolId, with only TODO comments indicating the need for migration.

## Current Status
The original task added TODO comments to interfaces but did not perform the actual migration:

### Currently Documented Interfaces (with TODOs)
```typescript
// In type_tracking.ts
interface LegacyTypeInfo {
  variable_name?: string;  // ✅ DOCUMENTED: TODO migrate to SymbolId
  type_name: string;       // ✅ DOCUMENTED: TODO migrate to SymbolId
}

interface ImportedClassInfo {
  class_name: string;      // ✅ DOCUMENTED: TODO migrate to SymbolId  
  local_name: string;      // ✅ DOCUMENTED: TODO migrate to SymbolId
}
```

## Work Required

### Phase 1: Interface Migration Planning
- [ ] Survey all interfaces with TODO comments about SymbolId migration
- [ ] Identify all consuming code that would be affected
- [ ] Plan migration strategy (breaking change vs. dual interface approach)

### Phase 2: Create New Interface Versions
- [ ] Create new versions of interfaces using SymbolId:
  ```typescript
  interface TypeInfo {
    variable_name?: SymbolId;  
    type_name: SymbolId;
  }
  
  interface ImportedClassInfo {
    class_name: SymbolId;
    local_name: SymbolId;
  }
  ```

### Phase 3: Migration Strategy Implementation
**Option A: Breaking Change (Preferred)**
- [ ] Replace legacy interfaces with SymbolId versions
- [ ] Update all consuming code to use SymbolId
- [ ] Provide migration script/documentation

**Option B: Dual Interface (If needed for compatibility)**  
- [ ] Keep legacy interfaces with deprecation warnings
- [ ] Create new SymbolId interfaces with different names
- [ ] Gradually migrate consumers

### Phase 4: Consumer Updates
- [ ] Update all functions creating these interface objects
- [ ] Update all functions consuming these interface objects  
- [ ] Update tests to use new interface shapes
- [ ] Update documentation

## Interfaces to Update
**Confirmed from Task 23 documentation**:
- `LegacyTypeInfo` in type_tracking.ts
- `ImportedClassInfo` in type_tracking.ts

**Additional interfaces to survey**:
- Any other interfaces in type_tracking with string identifiers
- Interface definitions in import/export modules  
- Call graph interface definitions
- Symbol resolution interface definitions

## Success Criteria
- ✅ All legacy interfaces updated to use SymbolId for identifiers
- ✅ All consuming code updated to work with new interfaces
- ✅ No TODO comments remain about SymbolId migration
- ✅ Type safety improved with branded types
- ✅ Documentation updated to reflect new interface shapes

## Impact Analysis
**Breaking Change**: Yes - this will affect all code using these interfaces
**Mitigation**: 
- Coordinate with team before implementation
- Provide clear migration path
- Consider timing with other breaking changes

## Files to Update
**Primary**:
- `packages/core/src/type_analysis/type_tracking/type_tracking.ts`
- All files importing and using the affected interfaces

**To be surveyed**:
- Other modules with similar legacy interfaces

## Dependencies  
**Should be done after**: 
- Task 11.100.0.5.23.4 (Type Tracking Export Issues)
- Task 11.100.0.5.23.5 (Function Updates)

## Estimated Time
2-3 days (depends on scope of consuming code)

## Risk Assessment
- **Medium Risk**: Breaking change requires coordination
- **Mitigation**: Plan carefully, provide migration support, coordinate timing

## Notes  
This task converts the TODO comments from the original Symbol Refactor into actual implementation. It represents the final step in making the codebase fully SymbolId-based for identifier handling.

The impact will be significant but worthwhile for long-term type safety and consistency. Should be coordinated with the team as a planned breaking change.