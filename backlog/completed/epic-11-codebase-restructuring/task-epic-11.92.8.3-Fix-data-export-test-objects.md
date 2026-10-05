# Task: Fix data_export Test Objects

**Task ID**: task-epic-11.92.8.3
**Parent**: task-epic-11.92.8
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 0.5 hours

## Summary

Fix incorrect enum values and type mismatches in data_export.test.ts, particularly the TypeCategory enum usage.

## Problem

Specific errors:
- Line 68: TS2345 - `"DataModel"` is not assignable to TypeCategory enum
- Line 319: TS2345 - FilePath assigned where Location expected
- Plus 3 ReadonlyMap mutation issues (covered in task-epic-11.92.5.2)

## Root Cause

1. Using string literals instead of TypeCategory enum values
2. Confusing FilePath with Location types
3. Attempting to mutate readonly properties

## Solution

1. **Fix TypeCategory usage**
   ```typescript
   // Before
   const type_id = defined_type_id("DataModel", location);

   // After
   import { TypeCategory } from '@ariadnejs/types';
   const type_id = defined_type_id(TypeCategory.CLASS, "DataModel", location);
   ```

2. **Fix Location vs FilePath**
   ```typescript
   // Before
   const result = someFunction(file_path);

   // After
   const location: Location = {
     file_path: file_path,
     line: 1,
     column: 0,
     end_line: 1,
     end_column: 0
   };
   const result = someFunction(location);
   ```

## Implementation Steps

1. **Fix Line 68 - TypeCategory** (10 min)
   - Import TypeCategory enum
   - Replace string with proper enum value
   - Verify the category is semantically correct

2. **Fix Line 319 - Location type** (10 min)
   - Create proper Location object
   - Or use existing location if available
   - Ensure all required Location fields

3. **Quick verification** (10 min)
   - Run type check
   - Verify test logic unchanged

## Detailed Fixes

```typescript
// Line 68 fix
// Before
const type_id = defined_type_id("DataModel", location);

// After - determine correct category
const type_id = defined_type_id(
  TypeCategory.CLASS, // or INTERFACE, TYPE_ALIAS, ENUM
  "DataModel" as SymbolName,
  location
);

// Line 319 fix
// Before
export_data(file_path);

// After - create or use proper location
const location: Location = {
  file_path: file_path,
  line: 1,
  column: 0,
  end_line: 100, // Or actual end
  end_column: 0
};
export_data(location);

// Or if a location helper exists:
export_data(createLocation(file_path, 1, 0));
```

## Success Criteria

- [ ] TypeCategory enum used correctly
- [ ] Location vs FilePath types correct
- [ ] Original test logic preserved
- [ ] No new TypeScript errors
- [ ] Tests pass successfully

## Files to Modify

- `src/symbol_resolution/data_export/data_export.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run specific test
npx vitest run src/symbol_resolution/data_export/data_export.test.ts
```

## Dependencies

- ReadonlyMap issues handled in task-epic-11.92.5.2
- May benefit from location helper utilities

## Notes

- This is the quickest task - only 2 specific fixes
- Ensure TypeCategory choice is semantically correct
- Consider if Location should have been FilePath or vice versa
- Document any assumptions about location values