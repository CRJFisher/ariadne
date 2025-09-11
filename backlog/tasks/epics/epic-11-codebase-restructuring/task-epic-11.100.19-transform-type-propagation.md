# Task 11.100.19: Transform type_propagation to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.19.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.19.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/type_analysis/type_propagation/`
**Files**: 5+ files (~1,500 lines)

- `type_propagation.ts` - Core type propagation
- Recently refactored to configuration pattern (45% reduction)
- Still uses manual AST traversal for type flow
- Already achieved significant simplification

## Current Implementation

### Manual Type Propagation

```typescript
function propagate_types(node: SyntaxNode) {
  // Variable assignment propagation
  if (node.type === "assignment_expression") {
    const left = node.childForFieldName("left");
    const right = node.childForFieldName("right");

    const rightType = inferExpressionType(right);
    setSymbolType(left.text, rightType);
  }

  // Return type propagation
  else if (node.type === "return_statement") {
    const value = node.childForFieldName("value");
    if (value) {
      const returnType = inferExpressionType(value);
      propagateReturnType(returnType);
    }
  }

  // Parameter type propagation from calls
  else if (node.type === "call_expression") {
    const func = node.childForFieldName("function");
    const args = node.childForFieldName("arguments");

    const funcType = getSymbolType(func.text);
    if (funcType && funcType.parameters) {
      propagateArgumentTypes(args, funcType.parameters);
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; type_propagation_queries.scm

;; Variable assignment type flow
(assignment_expression
  left: (identifier) @propagation.target
  right: (_) @propagation.source) @propagation.assignment

;; Variable declaration with initializer
(variable_declarator
  name: (identifier) @propagation.target
  value: (_) @propagation.source) @propagation.declaration

;; Return statement type flow
(return_statement
  (_) @propagation.return.value) @propagation.return
  (#has-ancestor? @propagation.return function_declaration)

;; Function call argument propagation
(call_expression
  function: (_) @propagation.call.function
  arguments: (arguments
    (_) @propagation.call.arg)) @propagation.call

;; Method call propagation
(call_expression
  function: (member_expression
    object: (_) @propagation.method.receiver
    property: (property_identifier) @propagation.method.name)
  arguments: (arguments
    (_) @propagation.method.arg)) @propagation.method.call

;; Property assignment propagation
(assignment_expression
  left: (member_expression
    object: (_) @propagation.object
    property: (property_identifier) @propagation.property)
  right: (_) @propagation.value) @propagation.property.assign

;; Array element type propagation
(assignment_expression
  left: (subscript_expression
    object: (_) @propagation.array
    index: (_) @propagation.index)
  right: (_) @propagation.element) @propagation.array.assign

;; Destructuring propagation
(variable_declarator
  name: (object_pattern
    (shorthand_property_identifier_pattern) @propagation.destructured.prop)
  value: (_) @propagation.destructured.source) @propagation.destructuring

;; Type assertion propagation
(as_expression
  expression: (_) @propagation.assertion.value
  type: (_) @propagation.assertion.type) @propagation.assertion

;; Ternary operator type flow
(ternary_expression
  condition: (_) @propagation.ternary.condition
  consequence: (_) @propagation.ternary.true
  alternative: (_) @propagation.ternary.false) @propagation.ternary

;; Binary expression type inference
(binary_expression
  left: (_) @propagation.binary.left
  operator: (_) @propagation.binary.op
  right: (_) @propagation.binary.right) @propagation.binary

;; Spread operator propagation
(spread_element
  (_) @propagation.spread.source) @propagation.spread

;; Python type annotation flow
(annotated_assignment
  target: (identifier) @propagation.target
  annotation: (type) @propagation.annotation
  value: (_)? @propagation.value) @propagation.python.annotated

;; Rust type inference points
(let_declaration
  pattern: (identifier) @propagation.target
  value: (_) @propagation.source
  type: (_)? @propagation.explicit_type) @propagation.rust.let

;; Generic type propagation
(generic_type
  (type_identifier) @propagation.generic.base
  type_arguments: (type_arguments
    (_) @propagation.generic.arg)) @propagation.generic

;; Promise/async type unwrapping
(await_expression
  (_) @propagation.await.promise) @propagation.await
```

### New Implementation

```typescript
export function propagate_types_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language,
  initialTypes: Map<string, TypeInfo>
): TypePropagationResult {
  const query = loadPropagationQuery(language);
  const captures = query.captures(tree.rootNode);

  // Build propagation graph
  const graph = buildPropagationGraph(captures);

  // Initialize with known types
  const types = new Map(initialTypes);

  // Propagate types through graph
  const result = propagateThroughGraph(graph, types);

  return result;
}

function buildPropagationGraph(captures: QueryCapture[]): PropagationGraph {
  const graph: PropagationGraph = {
    nodes: new Map(),
    edges: [],
  };

  // Group propagations by type
  const propagations = groupByPropagationType(captures);

  for (const [type, group] of propagations) {
    switch (type) {
      case "assignment":
        processAssignmentPropagation(group, graph);
        break;
      case "return":
        processReturnPropagation(group, graph);
        break;
      case "call":
        processCallPropagation(group, graph);
        break;
      case "destructuring":
        processDestructuringPropagation(group, graph);
        break;
    }
  }

  return graph;
}

function propagateThroughGraph(
  graph: PropagationGraph,
  types: Map<string, TypeInfo>
): TypePropagationResult {
  const result: TypePropagationResult = {
    propagatedTypes: new Map(),
    typeFlows: [],
    conflicts: [],
  };

  // Worklist algorithm for type propagation
  const worklist = [...graph.edges];
  const visited = new Set<string>();

  while (worklist.length > 0) {
    const edge = worklist.shift()!;
    const edgeId = `${edge.source}->${edge.target}`;

    if (visited.has(edgeId)) continue;
    visited.add(edgeId);

    const sourceType =
      types.get(edge.source) || inferNodeType(graph.nodes.get(edge.source));

    if (sourceType) {
      const targetNode = graph.nodes.get(edge.target);

      if (targetNode) {
        // Apply type transformation if needed
        const propagatedType = applyTransformation(
          sourceType,
          edge.transformation
        );

        // Check for conflicts
        const existingType = types.get(edge.target);
        if (existingType && !typesCompatible(existingType, propagatedType)) {
          result.conflicts.push({
            symbol: edge.target,
            existing: existingType,
            propagated: propagatedType,
            location: targetNode.location,
          });
        } else {
          types.set(edge.target, propagatedType);
          result.propagatedTypes.set(edge.target, propagatedType);

          // Track flow
          result.typeFlows.push({
            from: edge.source,
            to: edge.target,
            type: propagatedType,
            reason: edge.reason,
          });

          // Add dependent edges to worklist
          const dependentEdges = graph.edges.filter(
            (e) => e.source === edge.target
          );
          worklist.push(...dependentEdges);
        }
      }
    }
  }

  return result;
}
```

## Transformation Steps

### 1. Document Propagation Patterns

- [ ] Assignment flows
- [ ] Return type flows
- [ ] Parameter propagation
- [ ] Property assignments
- [ ] Destructuring flows
- [ ] Type assertions

### 2. Create Propagation Queries

- [ ] **Create language-specific .scm files**:
  - `queries/type_propagation.javascript.scm` - JS type flows, inference points
  - `queries/type_propagation.typescript.scm` - TS type flows, annotations, assertions
  - `queries/type_propagation.python.scm` - Python type flows, annotations, inference
  - `queries/type_propagation.rust.scm` - Rust type flows, ownership, inference
- [ ] All flow patterns
- [ ] Type sources and targets
- [ ] Transformation points
- [ ] Language-specific flows

### 3. Build Propagation Graph

- [ ] Node identification
- [ ] Edge construction
- [ ] Flow dependencies
- [ ] Transformation rules

### 4. Implement Propagation Algorithm

- [ ] Worklist processing
- [ ] Type inference
- [ ] Conflict detection
- [ ] Flow tracking

## Expected Improvements

### Code Reduction

- **Before**: ~1,500 lines (already reduced from 2,800)
- **After**: ~150 lines + queries
- **Additional Reduction**: 90% (from current)
- **Total Reduction**: 95% (from original)

### Accuracy

- Complete flow tracking
- Better conflict detection
- Transformation handling

### Performance

- Graph-based propagation
- Single-pass flow analysis
- Efficient worklist algorithm

## Success Criteria

### Functional Requirements
- [ ] All type flows captured
- [ ] Conflicts detected
- [ ] Transformations applied
- [ ] 90% additional reduction (from current 1,500 lines)
- [ ] Tests still passing

### Quality Gates (MANDATORY)

**All quality gates are defined in the required subtasks:**

- [ ] **100% test coverage achieved** (Task 11.100.X.1)
- [ ] **All tests passing** (Task 11.100.X.1)  
- [ ] **Zero TypeScript compilation errors** (Task 11.100.X.2)
- [ ] **Zero TypeScript warnings** (Task 11.100.X.2)
- [ ] **Performance improvement validated** (queries faster than manual)
- [ ] **Real-world accuracy confirmed** (corpus/ validation passes)
- [ ] **All language-specific .scm files created and tested**
## Dependencies

- Uses type_tracking for initial types
- Uses symbol_resolution for symbols
- Integrates with all type analysis modules
- Critical for accurate type inference

## Notes

- Recently refactored with 45% reduction
- Already uses configuration pattern
- Graph-based approach more efficient
- Must maintain type safety
- Complex but critical module
