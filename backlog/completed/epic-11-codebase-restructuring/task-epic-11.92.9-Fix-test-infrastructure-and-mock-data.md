# Task: Fix Test Infrastructure and Mock Data

**Task ID**: task-epic-11.92.9
**Parent**: task-epic-11.92
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1.5 days

## Summary

Fix test infrastructure issues including mock data structure mismatches, missing required properties in test objects, and alignment between test expectations and actual implementation interfaces.

## Problem Analysis

### Major Issues

1. **Missing Required Properties in Test Objects** (30+ errors)
   - SymbolDefinition missing: `is_hoisted`, `is_exported`, `is_imported`
   - LocalTypeTracking missing: `annotations`
   - LexicalScope symbols have incomplete definitions

2. **Mock Data Structure Mismatches**
   - Test mock objects don't match actual interfaces
   - Incomplete initialization of test data
   - Type assertions failing due to missing properties

3. **Test Helper Issues**
   - File system mocks incompatible with actual fs types
   - Query loader test mocks have wrong signatures

## Affected Files

### High Impact Test Files
- `function_resolution.test.ts` - LexicalScope and SymbolDefinition issues
- `constructor_resolution.test.ts` - SymbolDefinition missing properties
- `query_loader.test.ts` - Mock fs incompatibility
- `type_resolution.comprehensive.test.ts` - Extensive mock data issues

## Implementation Strategy

### Step 1: Create Test Factory Functions (3 hours)

```typescript
// test_utils/factories.ts
export function createSymbolDefinition(partial: Partial<SymbolDefinition>): SymbolDefinition {
  return {
    id: partial.id ?? symbol_id("default"),
    name: partial.name ?? "test" as SymbolName,
    kind: partial.kind ?? "function",
    location: partial.location ?? createLocation(),
    scope_id: partial.scope_id ?? scope_id("test"),
    is_hoisted: partial.is_hoisted ?? false,
    is_exported: partial.is_exported ?? false,
    is_imported: partial.is_imported ?? false
  };
}

export function createLocalTypeTracking(partial: Partial<LocalTypeTracking>): LocalTypeTracking {
  return {
    declarations: partial.declarations ?? [],
    assignments: partial.assignments ?? [],
    annotations: partial.annotations ?? []  // Was missing
  };
}
```

### Step 2: Update All Test Mock Creation (4 hours)

Replace inline object literals with factory functions:

```typescript
// Before
const symbol: SymbolDefinition = {
  id: symbolId,
  name: symbolName,
  kind: "class",
  location: location,
  definition_scope: scopeId  // Wrong property, missing others
};

// After
const symbol = createSymbolDefinition({
  id: symbolId,
  name: symbolName,
  kind: "class",
  location: location,
  scope_id: scopeId
});
```

### Step 3: Fix File System Mocks (2 hours)

```typescript
// Before
vi.spyOn(fs, 'readFileSync').mockImplementation(
  (path: string) => content  // Wrong signature
);

// After
vi.spyOn(fs, 'readFileSync').mockImplementation(
  ((path: fs.PathOrFileDescriptor, options?: any) => {
    if (typeof path === 'string') {
      return content;
    }
    throw new Error('Unsupported path type');
  }) as any
);
```

### Step 4: Validate and Clean Up (2 hours)

- Run tests to identify remaining issues
- Update assertions to match new structures
- Remove any deprecated test patterns

## Test Data Alignment

### Required Properties Checklist

**SymbolDefinition:**
- ✅ id: SymbolId
- ✅ name: SymbolName
- ✅ kind: SymbolKind
- ✅ location: Location
- ✅ scope_id: ScopeId
- ❌ is_hoisted: boolean (missing in tests)
- ❌ is_exported: boolean (missing in tests)
- ❌ is_imported: boolean (missing in tests)

**LocalTypeTracking:**
- ✅ declarations: LocalDeclaration[]
- ✅ assignments: LocalAssignment[]
- ❌ annotations: LocalAnnotation[] (missing in tests)

## Success Criteria

- All test compilation errors resolved
- Mock data matches actual interfaces
- Test factories prevent future mismatches
- Tests can run without type errors

## Verification

```bash
# Check test compilation
npm run build 2>&1 | grep -E "\.test\.ts" | wc -l
# Expected: 0 errors in test files

# Run test suite
npm test -- --no-coverage
# Expected: Tests run (may fail functionally but should compile)
```

## Benefits

- Centralized test data creation
- Easier to update when interfaces change
- Type safety in tests
- Reduces duplicate code

## Dependencies

- Should be done after interface fixes (task-epic-11.92.6)
- Enables functional test fixes in later tasks

## Follow-up

- Document test data factory patterns
- Add validation to ensure test data completeness
- Consider generating factories from interfaces