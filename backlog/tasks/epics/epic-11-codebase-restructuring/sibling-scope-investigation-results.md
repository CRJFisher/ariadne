# Sibling Scope Investigation Results

**Date**: Task 11.112.2
**Status**: COMPLETED

## Executive Summary

**FINDING**: The sibling scope code IS necessary and IS being used correctly.

The comment claiming "semantic index creates sibling scopes for function name and body" is VALIDATED by empirical testing.

## Evidence

### Test Results

Running the sibling_scope_investigation.test.ts with debug logging revealed that the sibling scope code triggers in multiple scenarios:

1. **Named Function Expressions**: `const factorial = function fact(n) { ... }`
   - Creates TWO function scopes:
     - `function:test.js:2:19:5:2` (whole function body)
     - `function:test.js:2:28:2:32` (function name "fact")
   - The sibling code allows the function to reference itself by name

2. **Nested Functions**: Multiple functions at the same nesting level
   - Each function gets its name scope as a sibling to its body scope
   - Example: `inner1()` and `inner2()` can reference each other

3. **Block-Scoped Functions**: Functions inside if/while blocks
   - Block scope and function name scope become siblings
   - Allows function to be called within the block

### Debug Output Example

```
[SIBLING_SCOPE_DEBUG] Triggered!
  Current scope: block:test.js:2:36:5:2 type: block name: {...}
  Sibling scope: function:test.js:2:28:2:32 name: fact
  Sibling definitions: [ 'fact' ]
[SIBLING_SCOPE_DEBUG] Adding resolver: fact → function:test.js:2:28:2:32:fact
```

## Why Sibling Scopes Exist

The semantic index creates multiple scopes for certain constructs:

### Named Function Expressions

```javascript
const foo = function bar() {
  bar(); // Self-reference - must resolve to the function itself
};
```

Tree-sitter parses this as:
- `function_expression` node (captures as @scope.function)
- `identifier` node for "bar" (captures as @definition.function)

This results in:
1. A scope for the function body
2. A scope/definition for the function name
3. These scopes are siblings (share same parent)

### Why Normal Parent Scope Lookup Doesn't Work

When resolving `bar()` inside the function:
1. Current scope is the function body
2. Parent scope is the outer scope (where `foo` is defined)
3. The name `bar` is NOT in the parent scope - it's only visible inside the function
4. **Solution**: Check sibling scopes for function names

## Conclusion

**RECOMMENDATION**: KEEP the sibling scope code (lines 213-235 in scope_resolver_index.ts)

**RATIONALE**:
1. It IS being used (triggers in multiple test cases)
2. It solves a real problem (named function expression self-reference)
3. It matches the architectural design (semantic index creates these sibling scopes)
4. Removing it would break function self-reference resolution

## Improvement Opportunities

While the code is necessary, it could be improved:

1. **Update Comment**: The current comment is accurate but could be clearer:
   ```typescript
   // Special case: For function expression nodes or block scopes,
   // also collect definitions from sibling function name scopes.
   // This handles named function expressions where the function name
   // is only visible within the function body (not in parent scope).
   // Example: const foo = function bar() { bar(); }
   //          'bar' is a sibling scope to the function body.
   ```

2. **Test Coverage**: Add explicit test cases for:
   - Named function expression self-reference
   - Verify sibling scope code triggers
   - Verify resolution works correctly

3. **Scope Creation Analysis**: The scope creation seems to be working correctly, but there are many scopes being created (module scopes, function scopes for return statements, etc.). This might be investigated separately.

## Related Issues

**Scope Assignment Bug (Task 11.112.1)**: The excessive scope creation noticed during this investigation might be related to the scope assignment bug. The fact that classes are getting wrong scope_ids suggests the scope creation or assignment logic needs review.

## Files Modified

- Added debug logging: `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`
- Created test: `packages/core/src/resolve_references/scope_resolver_index/sibling_scope_investigation.test.ts`

## Next Steps

- **Do NOT remove sibling scope code**
- Update comment with clearer explanation (optional)
- Remove debug logging after task completion
- Focus on fixing the scope assignment bug (Task 11.112.1)
