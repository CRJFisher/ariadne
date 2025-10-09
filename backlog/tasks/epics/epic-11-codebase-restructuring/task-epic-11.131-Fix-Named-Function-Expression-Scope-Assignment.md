# Task: Fix Named Function Expression Scope Assignment

**Status**: Completed
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08

## Problem

Named function expressions in JavaScript are not being assigned to the correct scope. The function name should be defined in the function's own scope (for self-reference), but it's currently being assigned to the module scope.

### Failing Test

Test: [semantic_index.javascript.test.ts:2022](packages/core/src/index_single_file/semantic_index.javascript.test.ts#L2022) - "should allow named function expression to reference itself"

```javascript
const factorial = function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);  // 'fact' should resolve to function scope
};
```

**Expected**: `fact` definition scope = `function:test.js:1:32:4:1` (function scope)
**Actual**: `fact` definition scope = `module:test.js:1:1:4:2` (module scope)

### Root Cause

Named function expressions create a special binding where the function name is available inside the function body for self-reference. This name should be defined in the function's own scope, not in the parent scope.

The issue is that the function name `fact` is being captured as a definition in the wrong scope.

## Expected Behavior

For named function expressions:
- The variable name (`factorial`) belongs in the parent scope (module)
- The function name (`fact`) belongs in the function's own scope
- Self-references to `fact` inside the function should resolve to the function-scoped definition

## Investigation Steps

1. **Check JavaScript query patterns**:
   - Look at [javascript.scm](packages/core/src/index_single_file/query_code_tree/queries/javascript.scm)
   - Find how `function_expression` with names are captured
   - Determine if the name is being captured as a definition

2. **Examine definition processing**:
   - Check [javascript_builder.ts](packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts)
   - See how function expression names are processed
   - Verify scope assignment logic for function names

3. **Compare with arrow functions**:
   - Arrow functions don't have this pattern (no name binding)
   - Regular function declarations work differently (name in parent scope)
   - Named function expressions are the special case

## Solution Approach

### Option 1: Adjust Scope Assignment in Query
Modify the JavaScript query to capture named function expression names with special scope handling:
- Capture the function name separately from the variable assignment
- Mark it as belonging to the function's own scope

### Option 2: Special Case in Definition Builder
Add logic in `javascript_builder.ts` to:
- Detect named function expressions
- Override the scope assignment for the function name
- Place it in the function scope instead of parent scope

### Option 3: Post-Processing
After initial indexing:
- Identify named function expression patterns
- Relocate the function name definition to the function scope
- Update references accordingly

## Testing

```bash
# Run failing test
npm test -- semantic_index.javascript.test.ts -t "should allow named function expression to reference itself"

# Test resolution
# Verify that:
# 1. The variable 'factorial' is in module scope
# 2. The function name 'fact' is in function scope
# 3. The reference to 'fact' on line 3 can be resolved
```

## Acceptance Criteria

- [ ] Named function expression test passes
- [ ] Function name is defined in function's own scope
- [ ] Self-references inside function can resolve to function name
- [ ] Variable assignment is still in parent scope
- [ ] No regressions in other JavaScript function tests

## Related

- JavaScript named function expression semantics
- Function scope assignment (epic-11.120)
- Self-referential patterns
