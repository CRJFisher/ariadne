# Task: Fix type_resolution Test Interfaces

**Task ID**: task-epic-11.92.6.4
**Parent**: task-epic-11.92.6
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 3 hours

## Summary

Fix interface mismatches in type_resolution.comprehensive.test.ts, which has the highest concentration of TypeScript errors (77 total), many related to interface property mismatches.

## Problem

The test file has extensive interface compliance issues:
- Missing properties in mock objects
- Type mismatches between expected and actual interfaces
- Incorrect property types in test data
- Outdated interface usage

Common error patterns:
- TS2739: Type missing properties
- TS2740: Missing properties in object literals
- TS2322: Type not assignable
- TS2345: Argument type mismatch

## Specific Issues

Key problem areas identified:
1. TypeRegistry interface mismatches
2. TypeResolutionMap property issues
3. LocalTypeDefinition inconsistencies
4. ResolvedTypeDefinition missing fields
5. Test mock objects not matching production interfaces

## Solution Approach

1. **Audit all interface usage**
   - Compare test interfaces with production types
   - Identify all missing properties
   - Document type mismatches

2. **Create comprehensive mock builders**
   ```typescript
   function createMockTypeRegistry(): GlobalTypeRegistry {
     return {
       types: new Map() as ReadonlyMap<TypeId, TypeInfo>,
       type_locations: new Map() as ReadonlyMap<TypeId, Location>,
       symbols_to_types: new Map() as ReadonlyMap<SymbolId, TypeId>,
       // ... all required properties
     };
   }
   ```

3. **Fix property type mismatches**
   ```typescript
   // Instead of string where TypeId expected
   const type_id = "MyClass" as TypeId;

   // Instead of partial objects
   const fullObject: RequiredInterface = {
     ...defaults,
     ...overrides
   };
   ```

## Implementation Steps

1. **Phase 1: Interface Analysis** (30 min)
   - List all interfaces used in tests
   - Compare with production interfaces
   - Document all discrepancies

2. **Phase 2: Create Mock Builders** (1 hour)
   - Build comprehensive mock functions
   - Ensure all required properties included
   - Add appropriate default values

3. **Phase 3: Fix Test Data** (1.5 hours)
   - Update all mock objects
   - Fix type assertions
   - Ensure property types match

## Files to Modify

- `src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts`

## Example Fixes

```typescript
// Before - Missing properties
const type_def = {
  name: "MyClass",
  kind: "class",
  location: someLocation
};

// After - Complete interface
const type_def: LocalTypeDefinition = {
  name: "MyClass" as SymbolName,
  kind: "class",
  location: someLocation,
  file_path: "test.ts" as FilePath,
  direct_members: new Map(),
  extends_names: [],
  implements_names: [],
  is_exported: false,
  generic_parameters: []
};
```

## Success Criteria

- [ ] Reduce TypeScript errors by at least 40 (from 77)
- [ ] All interface compliance issues resolved
- [ ] Mock builders created and documented
- [ ] Tests maintain original validation logic
- [ ] No new errors introduced

## Testing

```bash
# Check error count before
npm run build 2>&1 | grep "type_resolution.comprehensive.test.ts" | wc -l

# After fixes
npm run build

# Run tests
npx vitest run src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts
```

## Dependencies

- Benefits from task-epic-11.92.5.3 (ReadonlyMap handling)
- Related to task-epic-11.92.9.2 (test infrastructure)
- Should coordinate with task-epic-11.92.6.5 (LocalMemberInfo)

## Notes

- This is the highest priority due to error concentration
- Consider splitting into smaller chunks if too complex
- Document any interface version conflicts
- May reveal issues in production interfaces