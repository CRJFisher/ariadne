# Task: Fix SemanticIndex Interface Compliance

**Task ID**: task-epic-11.92.6.2
**Parent**: task-epic-11.92.6
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 3 hours

## Summary

Add missing properties `local_types`, `local_type_annotations`, `local_type_tracking`, and `local_type_flow` to all SemanticIndex mock objects in function resolution tests.

## Problem

Multiple test files create SemanticIndex mocks that are missing required properties:

**Affected files:**
- `function_resolution.test.ts`: Lines 531, 693
- `resolution_priority.test.ts`: Lines 107, 159, 217, 246, 292, 304, 347, 409, 449, 486, 518, 555, 608, 659, 671

These missing properties cause TS2739 errors (type missing properties).

## Required Interface

```typescript
interface SemanticIndex {
  file_path: FilePath;
  language: Language;
  root_scope_id: ScopeId;
  scopes: Map<ScopeId, LexicalScope>;
  symbols: Map<SymbolId, SymbolDefinition>;
  references: References;
  imports: Import[];
  exports: Export[];
  file_symbols_by_name: Map<SymbolName, SymbolId[]>;

  // Missing in test mocks:
  local_types: LocalTypeDefinition[];
  local_type_annotations: LocalTypeAnnotation[];
  local_type_tracking: LocalTypeTracking;
  local_type_flow: LocalTypeFlow[];
}
```

## Solution Approach

1. **Create a helper function for SemanticIndex mocks**
   ```typescript
   function createMockSemanticIndex(
     partial: Partial<SemanticIndex>
   ): SemanticIndex {
     return {
       // Required fields with defaults
       file_path: "test.js" as FilePath,
       language: "javascript",
       root_scope_id: "scope_0" as ScopeId,
       scopes: new Map(),
       symbols: new Map(),
       references: { calls: [], returns: [], member_accesses: [], type_annotations: [] },
       imports: [],
       exports: [],
       file_symbols_by_name: new Map(),
       local_types: [],
       local_type_annotations: [],
       local_type_tracking: { declarations: [], assignments: [], annotations: [] },
       local_type_flow: [],
       // Override with partial
       ...partial
     };
   }
   ```

2. **Update all mock creations to include missing properties**
   ```typescript
   const index = createMockSemanticIndex({
     file_path: "test.js" as FilePath,
     // ... other specific properties
   });
   ```

## Implementation Steps

1. Create the helper function in a test utilities file
2. Import helper in affected test files
3. Replace all inline SemanticIndex object creation with helper
4. Ensure all tests still validate intended behavior
5. Remove any type assertions that were working around the issue

## Success Criteria

- [ ] All TS2739 errors for SemanticIndex resolved
- [ ] Helper function created and reusable
- [ ] All affected test files updated
- [ ] Tests continue to pass with proper validation
- [ ] No new TypeScript errors introduced

## Files to Modify

- Create: `src/test_utils/semantic_index_helpers.ts`
- Update: `src/symbol_resolution/function_resolution/function_resolution.test.ts`
- Update: `src/symbol_resolution/function_resolution/resolution_priority.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run affected tests
npx vitest run src/symbol_resolution/function_resolution/
```

## Dependencies

- Benefits from task-epic-11.92.9.1 (mock factories) if completed first
- Related to task-epic-11.92.6.3 (SymbolDefinition properties)

## Notes

- Consider if these properties should be optional in tests
- The helper function will be reused across many test files
- Document which properties are commonly needed vs rarely used