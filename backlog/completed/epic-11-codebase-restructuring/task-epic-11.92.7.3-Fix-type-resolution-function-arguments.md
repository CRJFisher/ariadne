# Task: Fix type_resolution Function Arguments

**Task ID**: task-epic-11.92.7.3
**Parent**: task-epic-11.92.7
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 2.5 hours

## Summary

Fix multiple TS2345 errors (argument type mismatches) in type_resolution.comprehensive.test.ts where function calls have incorrect argument types.

## Problem

The test file has numerous function call issues:
- Wrong argument types passed to functions
- Type assertions missing or incorrect
- Mock data types not matching function signatures
- Complex nested type mismatches

This contributes significantly to the 77 total errors in this file.

## Common Patterns

1. **TypeId vs string**
   ```typescript
   // Wrong
   someFunction("MyClass");

   // Correct
   someFunction("MyClass" as TypeId);
   ```

2. **Location vs FilePath**
   ```typescript
   // Wrong
   someFunction(file_path);

   // Correct
   someFunction(location_object);
   ```

3. **Map vs ReadonlyMap arguments**
   ```typescript
   // Wrong
   someFunction(mutableMap);

   // Correct
   someFunction(mutableMap as ReadonlyMap<K, V>);
   ```

## Solution Approach

1. **Systematic type checking**
   - Review each TS2345 error
   - Identify expected vs actual types
   - Apply appropriate fixes

2. **Create type-safe helpers**
   ```typescript
   function createTypedArguments<T>(
     base: Partial<T>,
     overrides: Partial<T>
   ): T {
     return { ...base, ...overrides } as T;
   }
   ```

3. **Use proper type assertions**
   ```typescript
   const args = {
     type_id: "MyClass" as TypeId,
     location: createLocation(...),
     members: new Map() as ReadonlyMap<string, MemberInfo>
   };
   ```

## Implementation Steps

1. **Analyze error patterns** (30 min)
   - Group errors by type mismatch
   - Identify common fixes
   - Plan systematic approach

2. **Fix TypeId arguments** (30 min)
   - Add TypeId assertions where needed
   - Use proper type constructors
   - Ensure consistency

3. **Fix Map/ReadonlyMap issues** (45 min)
   - Cast mutable maps appropriately
   - Use ReadonlyMap constructors
   - Apply fixes from task-epic-11.92.5

4. **Fix complex type arguments** (45 min)
   - Location vs FilePath issues
   - Nested object type mismatches
   - Union type handling

5. **Verify and refactor** (30 min)
   - Run type check after each section
   - Extract common patterns
   - Document non-obvious fixes

## Example Fixes

```typescript
// Fix 1: TypeId argument
// Before
resolve_type("MyClass", location);

// After
resolve_type("MyClass" as TypeId, location);

// Fix 2: ReadonlyMap argument
// Before
process_types(mutableTypeMap, otherArg);

// After
process_types(
  mutableTypeMap as ReadonlyMap<TypeId, TypeInfo>,
  otherArg
);

// Fix 3: Complex object argument
// Before
create_resolution({
  types: typeMap,
  symbols: symbolMap
});

// After
create_resolution({
  types: typeMap as ReadonlyMap<TypeId, TypeInfo>,
  symbols: symbolMap as ReadonlyMap<SymbolId, SymbolInfo>
} as ResolutionContext);
```

## Success Criteria

- [ ] All TS2345 errors in file resolved
- [ ] Function calls type-safe
- [ ] No unsafe type assertions (as any)
- [ ] Tests maintain original logic
- [ ] Patterns documented for reuse

## Files to Modify

- `src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts`

## Testing

```bash
# Check specific errors
npm run build 2>&1 | grep "TS2345.*type_resolution.comprehensive"

# Verify compilation
npm run build

# Run tests
npx vitest run src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts
```

## Dependencies

- Benefits from task-epic-11.92.5.3 (ReadonlyMap handling)
- Related to task-epic-11.92.6.4 (interface fixes)
- Should use helpers from task-epic-11.92.5.4 if available

## Notes

- This is part of the highest-error file
- Focus on systematic fixes over one-offs
- Consider extracting type assertion helpers
- Document why certain assertions are safe