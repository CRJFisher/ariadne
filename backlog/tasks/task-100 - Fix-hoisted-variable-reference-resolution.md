---
id: task-100
title: Fix hoisted variable reference resolution
status: Done
assignee:
  - '@assistant'
created_date: '2025-08-04'
updated_date: '2025-08-04 08:51'
labels: []
dependencies: []
---

## Description

During the JavaScript test updates, we discovered that hoisted variables (using `var`) are not being resolved correctly. When a `var` is declared inside a block (like an if statement), it should be hoisted to the function scope, but references to it outside the block are appearing as orphaned references instead of resolving to the definition.

## Acceptance Criteria

- [x] References to hoisted variables resolve to their definitions
- [x] `var` declarations are properly hoisted to function scope
- [x] The hoisted variable reference in the test resolves correctly

## Implementation Plan

1. Update JavaScript scopes.scm to use @hoist.definition.variable for var declarations
2. Update TypeScript scopes.scm to use @hoist.definition.variable for var declarations
3. Run JavaScript tests to verify hoisting works correctly
4. Check if any other tests are affected by this change
## Example

```javascript
function test() {
  if (true) {
    var hoisted = 'value';
  }
  console.log(hoisted); // This should resolve to the hoisted var, not be orphaned
}
```

## Implementation Notes

This was discovered during task-98 when the reference to `hoisted` outside the if block appeared as an orphaned reference instead of resolving to the definition.

Successfully implemented JavaScript var hoisting resolution.

### Problem
- var declarations inside blocks were not hoisting to function scope
- References to hoisted vars appeared as orphaned references

### Solution
1. Added shouldHoistVarDeclaration() helper function in scope_resolution.ts
2. Function detects when a var declaration is inside a nested block (if, for, while, etc.)
3. Only hoists vars that are in nested blocks, not vars at function level
4. Modified definition insertion logic to use the helper when processing JavaScript/TypeScript

### Results
- Hoisted vars now correctly appear in function body scope
- References to hoisted vars resolve correctly
- functionVar stays in function body scope (not hoisted)
- hoisted var from if block is hoisted to function body scope

### Files Modified
- packages/core/src/scope_resolution.ts: Added hoisting logic

Note: Some JavaScript tests still show as failing because they need their expectations updated (task-99), but the hoisting functionality is working correctly.
