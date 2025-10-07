# Task: Fix JavaScript Scope Assignment In Semantic Tests

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-07

## Problem

The [semantic_index.javascript.test.ts](packages/core/src/index_single_file/semantic_index.javascript.test.ts) file has 5 test failures related to scope assignment:

### Failure Pattern

Tests are failing with scope ID mismatches where references are being assigned to nested/wrong scopes:

```
Expected scope: class:MyClass
Actual scope: method:myMethod::class:MyClass
```

This suggests that:
1. References within class methods are being assigned to the method scope instead of class scope
2. The scope hierarchy is incorrect for certain reference types
3. File-level definitions may be getting nested scope assignments

### Affected Test Cases

From test output:
- "should extract class with complete structure including constructor, methods, and properties"
- "should extract functions with complete structure"
- "should extract variables and constants with complete structure"
- "should extract imports with complete structure"
- "should capture only class body as scope for class declaration"

## Root Cause

This is similar to issues previously fixed in TypeScript/Python scope processors. The JavaScript language config may have:
- Incorrect scope assignment logic in reference builders
- Missing scope boundary detection
- Wrong parent scope selection in nested contexts

## Solution

1. **Investigate scope assignment in JavaScript builders**:
   - Review `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
   - Check reference builder scope assignment logic
   - Compare with TypeScript/Python implementations

2. **Fix scope assignment**:
   - Ensure file-level references get file scope
   - Ensure class member references get class scope (not method scope)
   - Verify nested class scope handling

3. **Update tests**:
   - Run `npm test -- semantic_index.javascript.test.ts`
   - Verify all scope assignments are correct

## Testing

```bash
cd packages/core
npm test -- semantic_index.javascript.test.ts
```

All tests should pass after fixes.

## Related

- Similar issues were fixed in task-epic-11.112 for TypeScript/Python
- See scope consolidation work in epic-11.112 tasks
