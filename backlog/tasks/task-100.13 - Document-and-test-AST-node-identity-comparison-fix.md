---
id: task-100.13
title: Document and test AST node identity comparison fix
status: To Do
assignee: []
created_date: '2025-08-05 12:01'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The fix for is_reference_called involved changing from object identity comparison to type checking because AST nodes are reparsed when multiple files are loaded. This fix needs comprehensive testing and documentation.

## Acceptance Criteria

- [ ] Add tests specifically for AST node comparison in multi-file scenarios
- [ ] Document the issue in code comments
- [ ] Ensure fix works with all tree-sitter language parsers
- [ ] Add regression test for the generateLargeFile scenario

## Technical Details

### The Bug
In `is_reference_called`, the original code checked:
```typescript
if (grandparent && grandparent.type === 'call_expression' && 
    grandparent.childForFieldName('function') === parent) {
  return true;
}
```

The object identity comparison `=== parent` fails when:
1. Multiple files are loaded into the project
2. The tree is reparsed (trees are immutable in tree-sitter)
3. New node objects are created with the same structure but different identity

### The Fix
Changed to check node type instead of identity:
```typescript
if (grandparent && grandparent.type === 'call_expression') {
  const functionChild = grandparent.childForFieldName('function');
  if (functionChild && functionChild.type === 'member_expression') {
    return true;
  }
}
```

### Why This Matters
This bug caused built-in method calls (arr.push, console.log, etc.) to not be detected in multi-file projects, leading to artificially low "nodes with calls" percentages in validation.

### Test Scenarios Needed
1. Single file with built-in calls (should work before and after)
2. Two files with built-in calls in first file
3. Many files (20+) with built-in calls scattered throughout
4. Re-adding a file should not change call detection
5. Test with different languages (TypeScript, JavaScript, Python, Rust)
