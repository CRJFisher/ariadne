---
id: task-19.2
title: Implement call reference traversal in ScopeGraph
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies: []
parent_task_id: task-19
---

## Description

Add methods to ScopeGraph to traverse references and identify which are function calls within a given function's scope.

## Acceptance Criteria

- [x] Method to get all references within a definition's range
- [x] Method to filter references that are function calls
- [x] Method handles nested function definitions correctly
- [x] Unit tests verify reference traversal

## Implementation Plan

1. Add helper method to check if a position is within a range
2. Filter references to only those within function boundaries
3. Resolve references to their definitions
4. Identify which resolved definitions are functions
5. Handle edge cases like nested functions

## Implementation Notes

Implemented reference traversal logic in the `get_function_calls()` method in `src/index.ts`:

### Key Implementation Details

1. **Position Range Checking**:
   ```typescript
   private is_position_within_range(pos: Point, range: { start: Point; end: Point }): boolean {
     // Check if position is after or at start
     if (pos.row < range.start.row) return false;
     if (pos.row === range.start.row && pos.column < range.start.column) return false;
     
     // Check if position is before or at end
     if (pos.row > range.end.row) return false;
     if (pos.row === range.end.row && pos.column > range.end.column) return false;
     
     return true;
   }
   ```

2. **Reference Filtering**:
   - Get all references from the ScopeGraph using `graph.refs()`
   - Filter to only references within the function's range
   - Uses both start and end positions to ensure accuracy

3. **Function Call Identification**:
   - For each reference, resolve it to its definition using `go_to_definition()`
   - Check if the resolved definition is a function/method/generator
   - Track the call location for each identified function call

4. **Method Call Detection**:
   - Added scope query patterns to capture method calls in all languages
   - TypeScript/JavaScript: `this.method()` patterns
   - Python: `self.method()` patterns
   - Excludes `super.method()` calls as they reference parent implementations

### Testing

The implementation is thoroughly tested in `src/call_graph.test.ts`:
- Tests reference traversal within function boundaries
- Verifies nested function handling
- Tests method call detection
- Validates call location tracking

Modified files:
- src/index.ts: Added reference traversal logic in get_function_calls()
- src/languages/*/scopes.scm: Added method call patterns for better detection