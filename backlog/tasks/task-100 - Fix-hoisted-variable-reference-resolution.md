---
id: task-100
title: Fix hoisted variable reference resolution
status: To Do
created_date: '2025-08-04'
labels: []
dependencies: []
---

## Description

During the JavaScript test updates, we discovered that hoisted variables (using `var`) are not being resolved correctly. When a `var` is declared inside a block (like an if statement), it should be hoisted to the function scope, but references to it outside the block are appearing as orphaned references instead of resolving to the definition.

## Acceptance Criteria

- [ ] References to hoisted variables resolve to their definitions
- [ ] `var` declarations are properly hoisted to function scope
- [ ] The hoisted variable reference in the test resolves correctly

## Implementation Plan

1. Investigate how `var` hoisting is handled in scope resolution
2. Check if definitions need to be added to parent scope for `var` declarations
3. Implement proper hoisting behavior
4. Test with the variable declarations test case

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
