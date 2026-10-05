# Task: Fix function_resolution Mock Objects

**Task ID**: task-epic-11.92.8.2
**Parent**: task-epic-11.92.8
**Status**: Pending
**Priority**: High
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix missing properties in mock objects across function_resolution test files, focusing on quick completions of partial objects.

## Problem

Multiple test files in function_resolution have incomplete mock objects:
- `resolution_priority.test.ts`: 20 errors, many from incomplete mocks
- `function_resolution.test.ts`: 3 errors from missing properties
- Mock objects missing required fields causing TS2739/2740 errors

## Specific Issues

1. **SymbolDefinition mocks** - Missing `is_hoisted`, `is_exported`, `is_imported`
2. **SemanticIndex mocks** - Missing type-related properties
3. **LexicalScope mocks** - Potentially missing fields
4. **Reference objects** - Incomplete structure

## Solution Approach

1. **Complete SymbolDefinition mocks**
   ```typescript
   const symbol: SymbolDefinition = {
     id: symbol_id,
     name: "myFunc" as SymbolName,
     kind: "function",
     location: location,
     scope_id: scope_id,
     // Add missing:
     is_hoisted: true,
     is_exported: false,
     is_imported: false
   };
   ```

2. **Complete SemanticIndex mocks**
   ```typescript
   const index: SemanticIndex = {
     // ... existing properties
     // Add missing:
     local_types: [],
     local_type_annotations: [],
     local_type_tracking: {
       declarations: [],
       assignments: [],
       annotations: []
     },
     local_type_flow: []
   };
   ```

## Implementation Steps

1. **Scan for incomplete objects** (20 min)
   - Find all object literal errors
   - Identify patterns
   - Group by type

2. **Fix SymbolDefinition objects** (30 min)
   - Add boolean flags
   - Use semantically correct values
   - Be consistent across tests

3. **Fix SemanticIndex objects** (30 min)
   - Add type-related properties
   - Use empty arrays/objects where appropriate
   - Ensure consistency

4. **Fix other mock objects** (10 min)
   - Complete any remaining partials
   - Verify all required fields

## Example Fixes

```typescript
// Before - incomplete
const mock_symbol = {
  id: "sym_1" as SymbolId,
  name: "test" as SymbolName,
  kind: "variable"
};

// After - complete
const mock_symbol: SymbolDefinition = {
  id: "sym_1" as SymbolId,
  name: "test" as SymbolName,
  kind: "variable",
  location: {
    file_path: "test.js" as FilePath,
    line: 1,
    column: 0,
    end_line: 1,
    end_column: 4
  },
  scope_id: "scope_0" as ScopeId,
  is_hoisted: false,
  is_exported: false,
  is_imported: false
};

// Use helpers for common patterns
function createMockSymbol(overrides: Partial<SymbolDefinition>): SymbolDefinition {
  return {
    id: "sym_default" as SymbolId,
    name: "default" as SymbolName,
    kind: "variable",
    location: createLocation("test.js", 1, 0),
    scope_id: "scope_0" as ScopeId,
    is_hoisted: false,
    is_exported: false,
    is_imported: false,
    ...overrides
  };
}
```

## Success Criteria

- [ ] All object literal errors in function_resolution tests resolved
- [ ] Mock objects complete and type-safe
- [ ] Helper functions created for common patterns
- [ ] Tests maintain original logic
- [ ] No new errors introduced

## Files to Modify

- `src/symbol_resolution/function_resolution/resolution_priority.test.ts`
- `src/symbol_resolution/function_resolution/function_resolution.test.ts`

## Testing

```bash
# Check specific errors
npm run build 2>&1 | grep "function_resolution.*TS27"

# Verify compilation
npm run build

# Run tests
npx vitest run src/symbol_resolution/function_resolution/
```

## Dependencies

- Related to task-epic-11.92.6.2 and task-epic-11.92.6.3
- Can benefit from mock factories (task-epic-11.92.9.1)

## Notes

- Quick wins - just adding missing properties
- Focus on correctness of semantic values
- Extract helpers to reduce duplication
- Consider why these properties were missing