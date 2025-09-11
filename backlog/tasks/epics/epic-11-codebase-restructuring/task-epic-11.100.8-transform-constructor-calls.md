# Task 11.100.8: Transform constructor_calls to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.8.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.8.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/call_graph/constructor_calls/`
**Files**: 5+ files (~900 lines)

- `constructor_calls.ts` - Core constructor detection
- `constructor_calls.javascript.ts` - JS/TS new expressions
- `constructor_calls.typescript.ts` - TS-specific constructors
- `constructor_calls.python.ts` - Python **init** calls
- `constructor_calls.rust.ts` - Rust ::new patterns

## Current Implementation

### Manual Constructor Detection

```typescript
function find_constructor_calls(node: SyntaxNode) {
  // JavaScript/TypeScript new expressions
  if (node.type === "new_expression") {
    const constructor = node.childForFieldName("constructor");
    const arguments = node.childForFieldName("arguments");

    // Extract class name
    const className = getConstructorName(constructor);
    const argCount = countArguments(arguments);
    // ... track constructor call
  }

  // Python class instantiation
  else if (node.type === "call" && isClassCall(node)) {
    const className = node.childForFieldName("function").text;
    // ... detect Python constructor
  }

  // Rust struct construction
  else if (node.type === "struct_expression") {
    const structName = node.childForFieldName("name");
    // ... handle Rust patterns
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; constructor_queries.scm

;; JavaScript/TypeScript new expressions
(new_expression
  constructor: (_) @call.constructor.class
  arguments: (arguments) @call.constructor.args) @call.constructor.new

;; TypeScript generic constructors
(new_expression
  constructor: (identifier) @call.constructor.class
  type_arguments: (type_arguments) @call.constructor.generics
  arguments: (arguments) @call.constructor.args) @call.constructor.generic

;; Python class instantiation (calls that are classes)
(call
  function: (identifier) @call.constructor.class
  (#match? @call.constructor.class "^[A-Z]")
  arguments: (argument_list) @call.constructor.args) @call.constructor.python

;; Python __init__ calls (explicit)
(call
  function: (attribute
    object: (_) @call.constructor.class
    attribute: (identifier) @call.constructor.method
    (#eq? @call.constructor.method "__init__"))
  arguments: (argument_list) @call.constructor.args) @call.constructor.init

;; Rust struct literal construction
(struct_expression
  name: (type_identifier) @call.constructor.struct
  body: (field_initializer_list) @call.constructor.fields) @call.constructor.struct_literal

;; Rust ::new pattern
(call_expression
  function: (scoped_identifier
    path: (identifier) @call.constructor.struct
    name: (identifier) @call.constructor.method
    (#eq? @call.constructor.method "new"))
  arguments: (arguments) @call.constructor.args) @call.constructor.rust_new

;; Rust Box::new, Rc::new, Arc::new
(call_expression
  function: (scoped_identifier
    path: (identifier) @call.constructor.wrapper
    (#match? @call.constructor.wrapper "^(Box|Rc|Arc)$")
    name: (identifier) @call.constructor.method
    (#eq? @call.constructor.method "new"))
  arguments: (arguments
    (_) @call.constructor.inner_type)) @call.constructor.smart_pointer

;; Factory method patterns
(call_expression
  function: (member_expression
    object: (identifier) @call.constructor.class
    (#match? @call.constructor.class "^[A-Z]")
    property: (property_identifier) @call.constructor.factory
    (#match? @call.constructor.factory "^(create|from|of|build)"))
  arguments: (arguments) @call.constructor.args) @call.constructor.factory_method
```

### New Implementation

```typescript
export function find_constructor_calls_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): ConstructorCallInfo[] {
  const query = loadConstructorQuery(language);
  const captures = query.captures(tree.rootNode);

  // Group by constructor call type
  const constructorGroups = groupByConstructorCall(captures);

  return constructorGroups.map((group) => {
    const callType = detectConstructorType(group);

    switch (callType) {
      case "new_expression":
        return extractNewExpression(group);
      case "struct_literal":
        return extractStructLiteral(group);
      case "factory_method":
        return extractFactoryCall(group);
      case "python_class":
        return extractPythonConstructor(group);
      default:
        return extractGenericConstructor(group);
    }
  });
}

function extractNewExpression(group: QueryCapture[]): ConstructorCallInfo {
  const className = group.find((c) => c.name.endsWith(".class"))?.node.text;
  const args = group.find((c) => c.name.endsWith(".args"));

  return {
    class_name: className,
    constructor_type: "new",
    arguments_count: countConstructorArgs(args),
    has_type_arguments: hasGenerics(group),
    location: group[0].node.startPosition,
  };
}
```

## Transformation Steps

### 1. Document Constructor Patterns

- [ ] new expressions (new Class())
- [ ] Factory methods (Class.create())
- [ ] Python class calls (Class())
- [ ] Rust struct literals
- [ ] Rust ::new patterns
- [ ] Smart pointer construction

### 2. Create Constructor Queries

- [ ] **Create language-specific .scm files**:
  - `queries/constructor_calls.javascript.scm` - JS/TS new expressions and factory patterns
  - `queries/constructor_calls.typescript.scm` - TS generics, decorators, interfaces
  - `queries/constructor_calls.python.scm` - Python class instantiation and __init__
  - `queries/constructor_calls.rust.scm` - Rust struct literals and ::new patterns
- [ ] Distinguish constructor types
- [ ] Capture class/struct names
- [ ] Handle generic parameters
- [ ] Track factory patterns

### 3. Build Constructor Extractor

- [ ] Extract class names
- [ ] Count constructor arguments
- [ ] Identify constructor type
- [ ] Track generic parameters

### 4. Special Cases

- [ ] Super constructor calls
- [ ] Delegated constructors
- [ ] Copy constructors
- [ ] Builder patterns

## Expected Improvements

### Code Reduction

- **Before**: ~900 lines
- **After**: ~100 lines + queries
- **Reduction**: 89%

### Accuracy

- Catches all constructor patterns
- Properly identifies factory methods
- Handles language-specific idioms

## Success Criteria

### Functional Requirements
- [ ] All constructor patterns detected
- [ ] Class names correctly extracted
- [ ] Argument counts accurate
- [ ] Factory methods identified
- [ ] 85%+ code reduction

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

- Requires class_detection for class name resolution
- May need type_tracking for generic parameters
- Integrates with call_graph analysis

## Notes

- Constructor detection varies significantly by language
- Factory methods are common in JavaScript/TypeScript
- Rust has multiple construction patterns (literal, ::new)
- Python uses **init** but call site looks like regular function
