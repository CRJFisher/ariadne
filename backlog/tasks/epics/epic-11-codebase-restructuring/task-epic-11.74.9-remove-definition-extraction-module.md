# Task 11.74.9: Remove Definition Extraction Module

## Status: Created
**Priority**: MEDIUM
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Deprecation

## Summary

Remove the `definition_extraction` module entirely as its functionality is already covered by `scope_tree` and `class_detection`. This module is partially implemented, not wired, and completely redundant.

## Context

The `definition_extraction` module contains only `def_factory.ts` which provides utilities for extracting definitions. However:
- `scope_tree` already extracts function and variable definitions
- `class_detection` already extracts class definitions
- The module is not wired into the pipeline
- It duplicates existing functionality

## Problem Statement

This module adds no value and creates confusion:
```typescript
// definition_extraction/def_factory.ts attempts to:
- find_function_node() - Already done by scope_tree
- get_enclosing_class_name() - Already tracked by scope_tree
- Extract definitions - Core responsibility of other modules
```

## Success Criteria

- [ ] Module functionality verified as redundant
- [ ] Any unique utilities moved to appropriate modules
- [ ] All imports of definition_extraction removed
- [ ] Module deleted from codebase
- [ ] file_analyzer.ts updated if needed

## Technical Approach

### Removal Strategy

1. **Audit for unique features**
2. **Move any unique utilities**
3. **Update imports**
4. **Delete module**

### Implementation Steps

1. **Check current usage**:
```bash
# Find any imports of definition_extraction
grep -r "definition_extraction" packages/core/src/

# Check what's in the module
ls -la packages/core/src/definition_extraction/
```

2. **Analyze def_factory.ts functions**:
```typescript
// Functions to audit:
- find_function_node(root_node, range)
- get_enclosing_class_name(scopes, byte_offset)
```

3. **Move utilities if needed**:
```typescript
// If find_function_node is useful, move to ast/node_utils.ts
// packages/core/src/ast/node_utils.ts

export function find_function_node(
  root: SyntaxNode,
  range: Range
): SyntaxNode | null {
  // Implementation if worth keeping
}

// If get_enclosing_class_name is useful, move to utils/scope_utils.ts
// packages/core/src/utils/scope_utils.ts

export function get_enclosing_class_name(
  scopes: ScopeTree,
  offset: number
): string | null {
  // Implementation if worth keeping
}
```

4. **Update file_analyzer.ts if it uses these**:
```typescript
// Check if file_analyzer imports from definition_extraction
// If yes, update to use the new locations or remove usage
```

5. **Delete the module**:
```bash
# Remove the directory
rm -rf packages/core/src/definition_extraction/

# Verify no broken imports
npm run build
```

## Dependencies

- Check if file_analyzer.ts uses this module
- Ensure no other modules import from it

## Testing Requirements

### Verification Tests
```typescript
test("build succeeds after removal", () => {
  // Run build to ensure no broken imports
  exec("npm run build");
});

test("all definition extraction still works", () => {
  // Verify scope_tree still extracts definitions
  const scopes = build_scope_tree(ast, source, language);
  expect(scopes.functions).toBeDefined();
  expect(scopes.classes).toBeDefined();
});
```

## Risks

1. **Hidden Dependencies**: Other code might import this
2. **Utility Loss**: Might lose useful helper functions

## Implementation Notes

### Why This Module Exists

Likely created early in development when:
- Scope analysis wasn't comprehensive
- Needed quick definition extraction
- Before architectural patterns were established

### Why It's Redundant Now

- scope_tree handles all symbol/definition extraction
- class_detection handles class-specific extraction
- Layer architecture makes this module unnecessary

## Estimated Effort

- Audit: 0.5 hours
- Move utilities: 0.5 hours
- Delete and verify: 0.5 hours
- **Total**: 0.5 days

## Notes

This is a straightforward removal of dead code. The module serves no purpose and isn't connected to anything. Removing it will reduce confusion and maintenance burden. Any useful utilities should be moved to more appropriate locations before deletion.