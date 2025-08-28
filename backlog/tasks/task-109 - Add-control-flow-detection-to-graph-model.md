---
id: task-109
title: Add control flow detection to code graph model
status: To Do
assignee: []
created_date: "2025-08-26"
labels: [enhancement, graph, analysis]
dependencies: [task-epic-11.32]
---

## Description

Add control flow analysis capabilities to the code graph model to track conditional branches, loops, and execution paths through code. This will enhance the graph with information about how code executes, not just its static structure.
This seems to be somewhat supported (at least modelled) by ScopeNode which includes ScopeType where 'block' is supported (for if/switch/for etc)

## Context

The current graph_builder (task-epic-11.32) creates a structural graph showing calls, imports, and inheritance. However, it doesn't capture control flow information like:

- Conditional branches (if/else, switch/case)
- Loops (for, while, do-while)
- Try/catch blocks
- Early returns and breaks
- Async control flow (await, generators)

This information is crucial for:

- Understanding code complexity
- Detecting unreachable code
- Analyzing execution paths
- Security analysis (taint tracking)
- Test coverage analysis

## Tasks

### Phase 1: Design

- [ ] Design control flow node and edge types
- [ ] Define control flow graph structure
- [ ] Plan integration with existing graph_builder

### Phase 2: Core Implementation

- [ ] Create control_flow feature module in `src/control_flow/`
- [ ] Implement basic block detection
- [ ] Implement control flow edge detection
  - [ ] Conditional edges (true/false branches)
  - [ ] Loop edges (entry, body, exit)
  - [ ] Exception edges (try/catch/finally)
  - [ ] Return/break/continue edges

### Phase 3: Language-Specific Implementation

- [ ] JavaScript/TypeScript control flow
  - [ ] If/else statements
  - [ ] Switch statements
  - [ ] For/while/do-while loops
  - [ ] Try/catch/finally
  - [ ] Async/await flow
- [ ] Python control flow
  - [ ] If/elif/else statements
  - [ ] For/while loops
  - [ ] Try/except/finally
  - [ ] With statements
  - [ ] Generator/yield flow
- [ ] Rust control flow
  - [ ] If/else expressions
  - [ ] Match expressions
  - [ ] Loop/while/for loops
  - [ ] Result/Option handling
  - [ ] Async/await flow

### Phase 4: Integration

- [ ] Integrate with graph_builder orchestration
- [ ] Add control flow edges to ProjectGraph
- [ ] Update graph queries to support control flow
- [ ] Add control flow metrics (cyclomatic complexity, etc.)

### Phase 5: Testing

- [ ] Unit tests for control flow detection
- [ ] Integration tests with graph_builder
- [ ] Cross-language test cases
- [ ] Complex control flow scenarios

## Acceptance Criteria

- [ ] Control flow is accurately detected for all supported languages
- [ ] Control flow edges are added to the project graph
- [ ] Graph queries can filter/traverse control flow edges
- [ ] Cyclomatic complexity can be calculated from the graph
- [ ] Performance impact is acceptable (<10% increase in analysis time)
- [ ] All tests pass with comprehensive coverage

## Technical Design

### Control Flow Node Types

```typescript
type ControlFlowNodeType =
  | "basic_block" // Sequential statements
  | "branch" // Decision point
  | "merge" // Join point
  | "loop_header" // Loop entry
  | "loop_exit" // Loop exit
  | "exception_handler" // Catch block
  | "finally_block" // Finally block
  | "return" // Return statement
  | "throw"; // Exception throw
```

### Control Flow Edge Types

```typescript
type ControlFlowEdgeType =
  | "sequential" // Normal flow
  | "conditional_true" // True branch
  | "conditional_false" // False branch
  | "loop_entry" // Enter loop
  | "loop_back" // Loop iteration
  | "loop_exit" // Exit loop
  | "exception" // Exception path
  | "return" // Function return
  | "break" // Break statement
  | "continue"; // Continue statement
```

### Integration with GraphBuilder

```typescript
interface ControlFlowAnalysis {
  analyze_control_flow(
    ast: Tree,
    metadata: { language: Language; file_path: string }
  ): {
    nodes: ControlFlowNode[];
    edges: ControlFlowEdge[];
    complexity: number;
  };
}
```

## Benefits

1. **Code Complexity Analysis**: Calculate cyclomatic complexity and other metrics
2. **Dead Code Detection**: Find unreachable code paths
3. **Test Coverage**: Understand which paths are tested
4. **Security Analysis**: Track data flow through control structures
5. **Refactoring Support**: Identify complex functions needing simplification
6. **Documentation**: Generate flow diagrams from code

## Notes

- Should follow Architecture.md patterns (functional style, colocated tests)
- Consider memory efficiency for large codebases
- May want to make control flow analysis optional for performance
- Could later extend to data flow analysis
- Consider visualization requirements early in design
