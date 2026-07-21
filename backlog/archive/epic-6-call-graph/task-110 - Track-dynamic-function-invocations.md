---
id: task-110
title: Track dynamic function invocations in call graph
status: To Do
assignee: []
created_date: '2025-08-20 12:00'
labels: [call-graph, enhancement, static-analysis]
dependencies: []
parent_task_id: epic-6
---

## Description

Verify and enhance Ariadne's ability to track function calls when the function reference is dynamically selected at runtime. This includes patterns like:
- Function references stored in objects/maps
- Functions selected via conditional logic
- Functions passed as parameters
- Dynamic method dispatch

## Problem Statement

Static analysis tools often struggle with dynamic dispatch patterns where the actual function called depends on runtime values. For example:

```javascript
// Pattern 1: Object/Map lookup
const handlers = {
  'add': handleAdd,
  'delete': handleDelete,
  'update': handleUpdate
};
const handler = handlers[action];  // action is runtime value
handler(data);

// Pattern 2: Conditional selection
const processor = useNewAPI ? processV2 : processV1;
processor(input);

// Pattern 3: Function as parameter
function execute(callback) {
  callback();
}
execute(myFunction);
```

## Current Behavior

Need to assess whether Ariadne currently:
- Tracks any dynamic invocations
- Loses the trail when functions are stored in variables
- Can follow function references through assignments

## Desired Behavior

Ideally, Ariadne should:
1. Track all possible call targets for dynamic dispatch
2. Mark calls as "potentially calls one of: [func1, func2, ...]"
3. Follow function references through variable assignments
4. Handle common patterns like event handlers, callbacks, and strategy patterns

## Acceptance Criteria

- [ ] Document current capabilities for tracking dynamic invocations
- [ ] Identify patterns that work vs those that don't
- [ ] Create test cases for common dynamic dispatch patterns
- [ ] Implement basic support for at least:
  - [ ] Functions stored in variables
  - [ ] Functions passed as parameters
  - [ ] Simple conditional function selection
- [ ] Update documentation with supported patterns

## Implementation Notes

### Phase 1: Assessment
1. Test current behavior with various dynamic patterns
2. Document which patterns are trackable
3. Identify low-hanging fruit improvements

### Phase 2: Basic Support
1. Track function assignments to variables
2. Follow function references through simple assignments
3. Handle callback parameters in common cases

### Phase 3: Advanced Support (Future)
1. Track all possible values in object/map lookups
2. Analyze conditional branches for possible function values
3. Support method dispatch based on type analysis

## Test Cases to Create

```javascript
// Test 1: Variable assignment
const myFunc = originalFunc;
myFunc(); // Should track to originalFunc

// Test 2: Callback parameter
setTimeout(myCallback, 100); // Should track myCallback

// Test 3: Object lookup (static keys)
const ops = { add, subtract };
ops.add(); // Should track to add function

// Test 4: Conditional assignment
const handler = condition ? handleA : handleB;
handler(); // Should track both possibilities
```

## Related Code Locations

- `packages/core/src/call_graph/call_analysis/reference_resolution.ts`
- `packages/core/src/call_graph/call_analysis/core.ts`
- Current dispatcher patterns that were just refactored to use switch statements

## Notes

This improvement came up during refactoring of dispatcher patterns from object maps to switch statements. Switch statements and if/else chains are easier for static analysis to follow than dynamic object property access.