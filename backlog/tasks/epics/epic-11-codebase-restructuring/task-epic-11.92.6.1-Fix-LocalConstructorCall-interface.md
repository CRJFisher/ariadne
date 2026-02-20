# Task: Fix LocalConstructorCall Interface

**Task ID**: task-epic-11.92.6.1
**Parent**: task-epic-11.92.6
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Add missing `scope_id` property to all LocalConstructorCall mock objects in constructor_resolution.test.ts, fixing 9 TypeScript errors.

## Problem

The LocalConstructorCall interface requires a `scope_id` property, but test mock objects are missing it:
- Line 136: Missing in basic constructor call test
- Line 259: Missing in class resolution test
- Line 264: Missing in class resolution test
- Line 318: Missing in namespace test
- Line 397: Missing in error handling test
- Line 429: Missing in cross-file test
- Line 468: Missing in import test
- Line 533: Missing in TypeScript test
- Line 621: Missing in comprehensive test

## Current Interface

```typescript
interface LocalConstructorCall {
  class_name: SymbolName;
  location: Location;
  argument_count: number;
  scope_id: ScopeId; // This is missing in tests
}
```

## Solution Approach

1. **Add scope_id to all mock objects**
   ```typescript
   const constructor_call: LocalConstructorCall = {
     class_name: "MyClass" as SymbolName,
     location: create_location("test.js", 5, 10),
     argument_count: 2,
     scope_id: "scope_1" as ScopeId  // Add this line
   };
   ```

2. **Use appropriate scope_id values**
   - Use the scope where the constructor call occurs
   - Match with existing scope structure in tests
   - Ensure consistency with semantic index mocks

## Implementation Steps

1. Review each test to understand the scope context
2. Identify appropriate scope_id for each constructor call
3. Add scope_id property to all 9 locations
4. Verify the scope_id matches the test's semantic structure
5. Run tests to ensure they still validate correct behavior

## Success Criteria

- [ ] All 9 TS2741 errors in constructor_resolution.test.ts resolved
- [ ] Each scope_id correctly represents the call's scope
- [ ] Tests continue to pass with correct validation logic
- [ ] No new TypeScript errors introduced

## Files to Modify

- `src/symbol_resolution/constructor_resolution.test.ts`

## Example Fix

```typescript
// Before
const constructor_call: LocalConstructorCall = {
  class_name: "MyClass" as SymbolName,
  location: create_location("test.js", 5, 10),
  argument_count: 2
};

// After
const constructor_call: LocalConstructorCall = {
  class_name: "MyClass" as SymbolName,
  location: create_location("test.js", 5, 10),
  argument_count: 2,
  scope_id: module_scope_id // Use the appropriate scope from test setup
};
```

## Testing

```bash
# Verify compilation
npm run build

# Run specific test file
npx vitest run src/symbol_resolution/constructor_resolution.test.ts
```

## Dependencies

None - this is an isolated interface compliance fix

## Notes

- Ensure scope_id values are consistent with the test's semantic index
- Consider if the scope_id addition to LocalConstructorCall was intentional
- Document why scope_id is needed if it affects test logic