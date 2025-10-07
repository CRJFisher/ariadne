# Task: Fix Nested Class Scope Assignment

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-07

## Problem

Nested classes (classes defined inside methods) are being assigned to `block` scope instead of `method` scope, causing test failure in [semantic_index.typescript.test.ts:1821](packages/core/src/index_single_file/semantic_index.typescript.test.ts#L1821).

### Failing Test

Test: "should assign correct scopes to nested classes"

```typescript
class Outer {
  method() {
    class Inner {
      innerMethod() {}
    }
  }
}
```

**Expected**: `innerClass.defining_scope_id` = `method:test.ts:2:3:6:4` (method scope)
**Actual**: `innerClass.defining_scope_id` = `block:test.ts:2:12:6:4` (block scope)

### Root Cause

The scope hierarchy is creating a `block` scope for the method body (starting at column 12, where `{` is), and the inner class is being assigned to this block scope instead of the parent method scope.

This suggests:
1. The method body's block is being captured as a separate scope
2. The scope assignment logic (`get_scope_id`) is choosing the block scope (deepest/smallest) instead of the method scope
3. Class definitions should be assigned to the enclosing callable scope (method/function), not to body blocks

### Impact

- **Severity**: Medium - Affects nested class scoping in TypeScript (rare pattern but valid)
- **Test Status**: 1 failing test in semantic_index.typescript.test.ts
- **Related**: Similar todo test exists in scope_processor.test.ts for Python nested classes

## Current Behavior

```
Scope Hierarchy (Current):
  module:test.ts:1:1:7:2
    └─ class:test.ts:1:15:7:2 (Outer body)
       └─ method:test.ts:2:3:6:4 (method declaration)
          └─ block:test.ts:2:12:6:4 (method body block) ← Inner class assigned here
```

## Expected Behavior

```
Scope Hierarchy (Expected):
  module:test.ts:1:1:7:2
    └─ class:test.ts:1:15:7:2 (Outer body)
       └─ method:test.ts:2:3:6:4 (method scope) ← Inner class should be assigned here
```

## Solution Approach

### Option 1: Scope Assignment Logic (Preferred)

Modify `scope_processor.ts:get_scope_id()` to treat certain definition types specially:
- Class definitions should skip block scopes and be assigned to the nearest callable scope (method/function/module)
- Function definitions may have similar requirements

### Option 2: Scope Capture Logic

Investigate why method bodies create separate block scopes:
- Check TypeScript .scm query patterns
- Determine if block scopes inside methods are necessary
- Consider if they should be filtered out

### Option 3: Hybrid Approach

Keep block scopes but enhance scope assignment logic:
- Maintain block scopes for variables/statements
- Skip block scopes for class/function definitions
- Use scope type awareness in `get_scope_id`

## Investigation Steps

1. **Examine scope creation**:
   ```bash
   npm test -- semantic_index.typescript.test.ts -t "should assign correct scopes to nested classes"
   ```
   Add debug logging to see all scopes created

2. **Review scope queries**:
   - Check [typescript.scm](packages/core/src/index_single_file/query_code_tree/queries/typescript.scm) for method body scope captures
   - Compare with JavaScript and Python query patterns

3. **Analyze get_scope_id logic**:
   - Review [scope_processor.ts](packages/core/src/index_single_file/scopes/scope_processor.ts) `get_scope_id` implementation
   - Understand current scope selection algorithm (depth-first? smallest?)

4. **Test other languages**:
   - Check if JavaScript has the same issue (likely yes)
   - Check if Python has similar patterns (todo test exists)

## Testing

```bash
# Run failing test
npm test -- semantic_index.typescript.test.ts -t "should assign correct scopes to nested classes"

# Run all scope tests
npm test -- scope_processor.test.ts semantic_index.typescript.test.ts

# After fix, implement Python nested class test
# Remove it.todo from scope_processor.test.ts line 1180
```

Expected outcomes:
- ✅ TypeScript nested class test passes
- ✅ Python nested class todo can be implemented
- ✅ JavaScript nested classes work (if tested)
- ✅ No regression in other scope assignment tests

## Implementation Notes

### Key Files

1. [scope_processor.ts](packages/core/src/index_single_file/scopes/scope_processor.ts) - `get_scope_id()` function
2. [typescript.scm](packages/core/src/index_single_file/query_code_tree/queries/typescript.scm) - Scope capture patterns
3. [semantic_index.typescript.test.ts:1775](packages/core/src/index_single_file/semantic_index.typescript.test.ts#L1775) - Failing test

### Considerations

- Should nested functions also skip block scopes?
- What about nested interfaces/enums?
- Does this affect lexical scope resolution?
- Performance impact of scope filtering

## Related

- Todo test in [scope_processor.test.ts:1180](packages/core/src/index_single_file/scopes/scope_processor.test.ts#L1180) - Python nested classes
- Body-based scope implementation (epic-11.112)
- Scope consolidation work (epic-11.112.9)

## Acceptance Criteria

- [ ] Nested class in TypeScript test passes
- [ ] Inner class assigned to method scope, not block scope
- [ ] Python nested class todo test can be implemented
- [ ] No regressions in existing scope tests
- [ ] Documentation updated if scope assignment rules change
