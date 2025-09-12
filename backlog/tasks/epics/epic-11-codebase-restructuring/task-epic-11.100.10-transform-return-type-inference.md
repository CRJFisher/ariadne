# Task 11.100.10: Transform return_type_inference to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.10.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.10.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/type_analysis/return_type_inference/`
**Files**: 5+ files (~1,500 lines)

- `return_type_inference.ts` - Core return type analysis
- `return_type_inference.javascript.ts` - JS type inference
- `return_type_inference.typescript.ts` - TS return annotations
- `return_type_inference.python.ts` - Python return hints
- `return_type_inference.rust.ts` - Rust return types

## Current Implementation

### Manual Return Type Analysis

```typescript
function infer_return_type(node: SyntaxNode) {
  if (node.type === "function_declaration") {
    // Check for explicit return type
    const returnType = node.childForFieldName("return_type");
    if (returnType) {
      return extractType(returnType);
    }

    // Infer from return statements
    const body = node.childForFieldName("body");
    const returnStatements = findReturnStatements(body);

    if (returnStatements.length === 0) {
      return "void";
    }

    // Analyze all return paths
    const types = returnStatements.map((ret) => {
      const value = ret.childForFieldName("value");
      return inferExpressionType(value);
    });

    return unifyTypes(types);
  }
}

function findReturnStatements(node: SyntaxNode): SyntaxNode[] {
  const returns = [];

  function traverse(n: SyntaxNode) {
    if (n.type === "return_statement") {
      returns.push(n);
    }
    // Don't traverse into nested functions
    else if (n.type !== "function_declaration" && n.type !== "arrow_function") {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return returns;
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; return_type_queries.scm

;; TypeScript explicit return types
(function_declaration
  name: (identifier) @return.function.name
  return_type: (type_annotation
    (_) @return.type.explicit)) @return.function.typed

(arrow_function
  return_type: (type_annotation
    (_) @return.type.explicit)) @return.arrow.typed

(method_definition
  name: (property_identifier) @return.method.name
  return_type: (type_annotation
    (_) @return.type.explicit)) @return.method.typed

;; Return statements (for inference)
(function_declaration
  name: (identifier) @return.function.name
  body: (statement_block
    (return_statement
      (_)? @return.value))) @return.function.inferred

;; Arrow function implicit returns
(arrow_function
  body: (_) @return.value
  (#not-type? @return.value statement_block)) @return.arrow.implicit

;; Python return type hints
(function_definition
  name: (identifier) @return.function.name
  return_type: (type) @return.type.explicit) @return.function.python

;; Python return statements
(function_definition
  name: (identifier) @return.function.name
  body: (block
    (return_statement
      (_)? @return.value))) @return.function.python.inferred

;; Python yield (generator functions)
(function_definition
  name: (identifier) @return.function.name
  body: (block
    (yield_statement
      (_)? @return.yield.value))) @return.generator.python

;; Rust explicit return types
(function_item
  name: (identifier) @return.function.name
  return_type: (_) @return.type.explicit) @return.function.rust

;; Rust implicit returns (last expression)
(function_item
  name: (identifier) @return.function.name
  body: (block
    (_) @return.last_expr)) @return.function.rust.implicit

;; Rust explicit return statements
(return_expression
  (_)? @return.value) @return.explicit.rust

;; Async function returns (wrapped in Promise)
(function_declaration
  (identifier) @return.function.name
  async: "async" @return.async
  return_type: (type_annotation
    (_) @return.type.promise)?) @return.function.async

;; Generator functions (yield)
(function_declaration
  name: (identifier) @return.function.name
  body: (statement_block
    (yield_expression
      (_)? @return.yield.value))) @return.generator

;; Early returns in conditionals
(if_statement
  consequence: (statement_block
    (return_statement
      (_)? @return.conditional.value))) @return.conditional

;; Switch/match returns
(switch_statement
  body: (switch_body
    (switch_case
      (return_statement
        (_)? @return.switch.value)))) @return.switch
```

### New Implementation

```typescript
export function infer_return_types_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): Map<string, ReturnTypeInfo> {
  const query = loadReturnTypeQuery(language);
  const captures = query.captures(tree.rootNode);

  // Group captures by function
  const functionGroups = groupByFunction(captures);
  const returnTypes = new Map<string, ReturnTypeInfo>();

  for (const [funcName, group] of functionGroups) {
    // Check for explicit return type
    const explicitType = group.find((c) => c.name.includes(".type.explicit"));

    if (explicitType) {
      returnTypes.set(funcName, {
        type: explicitType.node.text,
        source: "explicit",
        isAsync: hasAsyncMarker(group),
        isGenerator: hasYieldStatement(group),
      });
      continue;
    }

    // Infer from return statements
    const returnValues = group.filter((c) => c.name.includes(".value"));

    if (returnValues.length === 0) {
      // Check for implicit returns (Rust, arrow functions)
      const implicitReturn = findImplicitReturn(group);
      if (implicitReturn) {
        returnTypes.set(funcName, {
          type: inferValueType(implicitReturn),
          source: "implicit",
          isAsync: hasAsyncMarker(group),
          isGenerator: false,
        });
      } else {
        returnTypes.set(funcName, {
          type: "void",
          source: "inferred",
          isAsync: hasAsyncMarker(group),
          isGenerator: false,
        });
      }
    } else {
      // Unify all return types
      const types = returnValues.map((rv) => inferValueType(rv.node));

      returnTypes.set(funcName, {
        type: unifyReturnTypes(types),
        source: "inferred",
        isAsync: hasAsyncMarker(group),
        isGenerator: hasYieldStatement(group),
      });
    }
  }

  return returnTypes;
}

function unifyReturnTypes(types: string[]): string {
  // Remove duplicates
  const unique = [...new Set(types)];

  if (unique.length === 1) {
    return unique[0];
  }

  // Create union type
  return unique.sort().join(" | ");
}
```

## Transformation Steps

### 0. Migrate Functions from file_analyzer.ts [COMPLETED]

**STATUS**: ✅ The function `infer_all_return_types` has been successfully moved to `return_type_inference.ts`. 

**Type Cleanup Requirements**:
- Only the output type `ReturnTypeInfo` needs to remain public in `packages/types`
- All internal AST processing types should be DELETED from the types package (not deprecated)
- Internal types used only for AST traversal can now be local to the module or removed entirely with query-based approach

### 1. Document Return Patterns

- [ ] Explicit return type annotations
- [ ] Return statements with values
- [ ] Implicit returns (arrow functions, Rust)
- [ ] Void/undefined returns
- [ ] Generator/yield returns
- [ ] Async/Promise returns

### 2. Create Return Type Queries

- [ ] **Create language-specific .scm files**:
  - `queries/return_type_inference.javascript.scm` - JS return statements, implicit returns
  - `queries/return_type_inference.typescript.scm` - TS type annotations, Promise types
  - `queries/return_type_inference.python.scm` - Python type hints, yield statements
  - `queries/return_type_inference.rust.scm` - Rust explicit types, implicit returns
- [ ] Capture explicit types
- [ ] Find all return statements
- [ ] Handle implicit returns
- [ ] Track async/generator markers
- [ ] Conditional return paths

### 3. Build Type Inference

- [ ] Extract explicit types
- [ ] Infer from return values
- [ ] Unify multiple return types
- [ ] Handle Promise wrapping
- [ ] Generator type construction

### 4. Special Cases

- [ ] Early returns
- [ ] Conditional returns
- [ ] Never-returning functions
- [ ] Recursive functions
- [ ] Higher-order functions

## Expected Improvements

### Code Reduction

- **Before**: ~1,500 lines
- **After**: ~150 lines + queries
- **Reduction**: 90%

### Accuracy

- Captures all return paths
- Handles implicit returns
- Proper async/generator detection

### Performance

- Single-pass analysis
- No recursive traversal
- Efficient type unification

## Success Criteria

### Functional Requirements
- [ ] All return types captured
- [ ] Implicit returns handled
- [ ] Async/generator detected
- [ ] Type unification working
- [ ] 90% code reduction

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

- Uses type_tracking for value type inference
- Integrates with function_calls for call sites
- Required by type_propagation

## Notes

- Return type inference is complex in JavaScript
- TypeScript provides explicit types when available
- Rust has implicit returns (last expression)
- Python uses type hints but they're optional
- Must handle all return paths for accuracy
