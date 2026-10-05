# Task: Fix SymbolDefinition Properties

**Task ID**: task-epic-11.92.6.3
**Parent**: task-epic-11.92.6
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Add missing properties `is_hoisted`, `is_exported`, and `is_imported` to all SymbolDefinition instances in resolution_priority.test.ts.

## Problem

SymbolDefinition objects in tests are missing required boolean properties:
- Line 51: Missing all three properties
- Line 197: Missing all three properties
- Line 383: Missing all three properties

These cause TS2739 errors (type missing properties).

## Required Interface

```typescript
interface SymbolDefinition {
  id: SymbolId;
  name: SymbolName;
  kind: SymbolKind;
  location: Location;
  scope_id: ScopeId;

  // Missing in test mocks:
  is_hoisted: boolean;
  is_exported: boolean;
  is_imported: boolean;
}
```

## Solution Approach

1. **Add default values to existing mocks**
   ```typescript
   const symbol_def: SymbolDefinition = {
     id: symbol_id,
     name: "myFunction" as SymbolName,
     kind: "function",
     location: location,
     scope_id: scope_id,
     // Add these:
     is_hoisted: false,
     is_exported: false,
     is_imported: false
   };
   ```

2. **Create a helper function**
   ```typescript
   function createSymbolDefinition(
     partial: Omit<SymbolDefinition, 'is_hoisted' | 'is_exported' | 'is_imported'> &
     Partial<Pick<SymbolDefinition, 'is_hoisted' | 'is_exported' | 'is_imported'>>
   ): SymbolDefinition {
     return {
       ...partial,
       is_hoisted: partial.is_hoisted ?? false,
       is_exported: partial.is_exported ?? false,
       is_imported: partial.is_imported ?? false
     };
   }
   ```

## Implementation Steps

1. Locate all three error locations in the file
2. Determine appropriate values for each property based on test context
3. Add the three properties to each SymbolDefinition
4. Consider extracting a helper if pattern repeats
5. Verify tests still validate correct behavior

## Example Fixes

```typescript
// Line 51 - Function symbol
const function_def: SymbolDefinition = {
  id: function_id,
  name: function_name,
  kind: "function",
  location: { file_path, line: 1, column: 0, end_line: 3, end_column: 1 },
  scope_id: module_scope_id,
  is_hoisted: true,  // Functions are hoisted
  is_exported: false, // Not exported in this test
  is_imported: false  // Defined locally
};

// Line 197 - Variable symbol
const var_def: SymbolDefinition = {
  id: var_id,
  name: var_name,
  kind: "variable",
  location: { file_path, line: 1, column: 4, end_line: 1, end_column: 5 },
  scope_id: module_scope_id,
  is_hoisted: false,  // Variables not hoisted
  is_exported: false,
  is_imported: false
};
```

## Success Criteria

- [ ] All 3 TS2739 errors for SymbolDefinition resolved
- [ ] Properties have semantically correct values
- [ ] Tests continue to pass
- [ ] Consider if helper function improves maintainability

## Files to Modify

- `src/symbol_resolution/function_resolution/resolution_priority.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run specific test file
npx vitest run src/symbol_resolution/function_resolution/resolution_priority.test.ts
```

## Dependencies

- Related to task-epic-11.92.6.2 (SemanticIndex compliance)
- May benefit from task-epic-11.92.9.1 (mock factories)

## Notes

- Consider the semantic meaning of each property
- `is_hoisted`: true for functions and var declarations
- `is_exported`: true if symbol is exported from module
- `is_imported`: true if symbol comes from another module