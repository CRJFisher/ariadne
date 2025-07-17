---
id: task-19.3
title: Build call graph from scope analysis
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

Implement the logic to build a complete call graph by analyzing all functions and their call references across the project.

## Acceptance Criteria

- [x] Algorithm correctly identifies all function calls
- [x] Self/this method calls are properly detected
- [x] Call graph handles recursive calls
- [x] Call graph handles indirect calls via variables
- [x] Performance is optimized for large codebases

## Implementation Plan

1. Implement extract_call_graph() method
2. Iterate through all functions in the project
3. For each function, extract its calls
4. Aggregate results into complete call graph
5. Optimize for performance with large codebases

## Implementation Notes

Successfully implemented the `extract_call_graph()` method in `src/index.ts`:

### Implementation Details

```typescript
extract_call_graph(): {
  functions: Def[];
  calls: FunctionCall[];
} {
  const allFunctions: Def[] = [];
  const allCalls: FunctionCall[] = [];
  
  // Get all functions in the project
  const functionsByFile = this.get_all_functions();
  
  // Collect all functions and their calls
  for (const functions of functionsByFile.values()) {
    allFunctions.push(...functions);
    
    for (const func of functions) {
      const calls = this.get_function_calls(func);
      allCalls.push(...calls);
    }
  }
  
  return {
    functions: allFunctions,
    calls: allCalls
  };
}
```

### Key Features

1. **Complete Project Analysis**:
   - Uses `get_all_functions()` to find all functions across the project
   - Processes each function to extract its calls
   - Returns both the complete function list and all call relationships

2. **Method Call Detection**:
   - Properly detects `this.method()` calls in TypeScript/JavaScript
   - Properly detects `self.method()` calls in Python
   - Sets `is_method_call` flag appropriately

3. **Recursive Call Handling**:
   - Successfully identifies when a function calls itself
   - Test case validates factorial example with recursive calls

4. **Performance Considerations**:
   - Leverages existing ScopeGraph structures for efficiency
   - Avoids redundant parsing by reusing cached graphs
   - Linear time complexity relative to number of functions

5. **Edge Cases Handled**:
   - Non-function references are ignored
   - Empty projects return empty results
   - Cross-file calls are captured (though resolution may depend on import handling)

### Testing

Comprehensive test suite in `src/call_graph.test.ts` validates:
- Complete call graph extraction across multiple functions
- Recursive call detection
- Method call identification
- Multi-file projects
- Edge cases like non-function definitions

### Example Output

For a simple project:
```typescript
function util1() {}
function util2() { util1(); }
function main() {
  util1();
  util2();
}
```

The call graph returns:
- Functions: [util1, util2, main]
- Calls: 
  - main → util1
  - main → util2
  - util2 → util1

Modified files:
- src/index.ts: Added extract_call_graph() method
- src/call_graph.test.ts: Comprehensive test coverage