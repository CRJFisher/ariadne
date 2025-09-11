# Task 11.100.11: Transform parameter_type_inference to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.11.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.11.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/type_analysis/parameter_type_inference/`
**Files**: 5+ files (~1,200 lines)

- `parameter_type_inference.ts` - Core parameter analysis
- `parameter_type_inference.javascript.ts` - JS parameter patterns
- `parameter_type_inference.typescript.ts` - TS parameter types
- `parameter_type_inference.python.ts` - Python type hints
- `parameter_type_inference.rust.ts` - Rust parameter types

## Current Implementation

### Manual Parameter Type Extraction

```typescript
function infer_parameter_types(node: SyntaxNode) {
  if (node.type === "function_declaration") {
    const parameters = node.childForFieldName("parameters");
    const paramTypes = [];

    for (const param of parameters.children) {
      if (param.type === "identifier") {
        // Simple parameter, infer from usage
        paramTypes.push({
          name: param.text,
          type: inferFromUsage(param, node),
        });
      } else if (param.type === "typed_parameter") {
        // TypeScript/Python typed parameter
        const name = param.childForFieldName("name");
        const type = param.childForFieldName("type");
        paramTypes.push({
          name: name.text,
          type: extractType(type),
        });
      } else if (param.type === "assignment_pattern") {
        // Default parameter
        const left = param.childForFieldName("left");
        const right = param.childForFieldName("right");
        paramTypes.push({
          name: left.text,
          type: inferExpressionType(right),
          hasDefault: true,
        });
      } else if (param.type === "rest_pattern") {
        // Rest parameter
        const pattern = param.childForFieldName("pattern");
        paramTypes.push({
          name: pattern.text,
          type: "Array<unknown>",
          isRest: true,
        });
      }
    }

    return paramTypes;
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; parameter_type_queries.scm

;; JavaScript/TypeScript simple parameters
(function_declaration
  parameters: (formal_parameters
    (identifier) @param.simple.name)) @param.simple

;; TypeScript typed parameters
(function_declaration
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @param.typed.name
      type: (type_annotation
        (_) @param.typed.type)))) @param.typed

;; Optional parameters
(function_declaration
  parameters: (formal_parameters
    (optional_parameter
      pattern: (identifier) @param.optional.name
      type: (type_annotation
        (_) @param.optional.type)?))) @param.optional

;; Default parameters
(function_declaration
  parameters: (formal_parameters
    (assignment_pattern
      left: (identifier) @param.default.name
      right: (_) @param.default.value))) @param.default

;; Rest parameters
(function_declaration
  parameters: (formal_parameters
    (rest_pattern
      (identifier) @param.rest.name))) @param.rest

;; Destructured object parameters
(function_declaration
  parameters: (formal_parameters
    (object_pattern
      (shorthand_property_identifier_pattern) @param.destructured.property
      (pair_pattern
        key: (property_identifier) @param.destructured.key
        value: (identifier) @param.destructured.name)))) @param.destructured.object

;; Destructured array parameters
(function_declaration
  parameters: (formal_parameters
    (array_pattern
      (identifier) @param.destructured.element))) @param.destructured.array

;; Arrow function parameters
(arrow_function
  parameters: (identifier) @param.arrow.single) @param.arrow.simple

(arrow_function
  parameters: (formal_parameters
    (_) @param.arrow.formal)) @param.arrow

;; Python typed parameters
(function_definition
  parameters: (parameters
    (typed_parameter
      (identifier) @param.typed.name
      type: (type) @param.typed.type))) @param.typed.python

;; Python default parameters
(function_definition
  parameters: (parameters
    (default_parameter
      name: (identifier) @param.default.name
      value: (_) @param.default.value))) @param.default.python

;; Python *args and **kwargs
(function_definition
  parameters: (parameters
    (list_splat_pattern
      (identifier) @param.args.name))) @param.args.python

(function_definition
  parameters: (parameters
    (dictionary_splat_pattern
      (identifier) @param.kwargs.name))) @param.kwargs.python

;; Rust typed parameters
(function_item
  parameters: (parameters
    (parameter
      pattern: (identifier) @param.typed.name
      type: (_) @param.typed.type))) @param.typed.rust

;; Rust mutable parameters
(function_item
  parameters: (parameters
    (parameter
      (mut_pattern
        (identifier) @param.mutable.name)
      type: (_) @param.mutable.type))) @param.mutable.rust

;; Rust self parameters
(function_item
  parameters: (parameters
    (self_parameter) @param.self)) @param.self.rust

;; Generic type parameters
(function_declaration
  type_parameters: (type_parameters
    (type_parameter
      (type_identifier) @param.generic.name
      constraint: (_)? @param.generic.constraint))) @param.generic

;; Method parameters (class context)
(method_definition
  parameters: (formal_parameters
    (_) @param.method)) @param.method.context
```

### New Implementation

```typescript
export function infer_parameter_types_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): Map<string, ParameterInfo[]> {
  const query = loadParameterQuery(language);
  const captures = query.captures(tree.rootNode);

  // Group by function
  const functionParams = new Map<string, ParameterInfo[]>();
  const paramGroups = groupByFunction(captures);

  for (const [funcName, group] of paramGroups) {
    const params: ParameterInfo[] = [];

    // Sort parameters by position
    const sortedParams = sortParametersByPosition(group);

    for (const paramGroup of sortedParams) {
      const paramInfo = extractParameterInfo(paramGroup);

      // Infer type if not explicit
      if (!paramInfo.type) {
        paramInfo.type = inferParameterType(paramGroup);
      }

      params.push(paramInfo);
    }

    functionParams.set(funcName, params);
  }

  return functionParams;
}

function extractParameterInfo(group: QueryCapture[]): ParameterInfo {
  const nameCapture = group.find((c) => c.name.includes(".name"));
  const typeCapture = group.find((c) => c.name.includes(".type"));
  const defaultCapture = group.find((c) => c.name.includes(".value"));

  return {
    name: nameCapture?.node.text || "unknown",
    type: typeCapture?.node.text || null,
    hasDefault: !!defaultCapture,
    defaultValue: defaultCapture?.node.text,
    isOptional: group.some((c) => c.name.includes(".optional")),
    isRest: group.some((c) => c.name.includes(".rest")),
    isDestructured: group.some((c) => c.name.includes(".destructured")),
    position: nameCapture?.node.startPosition,
  };
}

function inferParameterType(group: QueryCapture[]): string {
  // Check for default value type
  const defaultValue = group.find((c) => c.name.includes(".value"));
  if (defaultValue) {
    return inferValueType(defaultValue.node);
  }

  // Check for rest/spread patterns
  if (group.some((c) => c.name.includes(".rest"))) {
    return "Array<any>";
  }

  if (group.some((c) => c.name.includes(".args"))) {
    return "Tuple<any>";
  }

  if (group.some((c) => c.name.includes(".kwargs"))) {
    return "Dict<string, any>";
  }

  // Default to unknown
  return "unknown";
}
```

## Transformation Steps

### 1. Document Parameter Patterns

- [ ] Simple parameters
- [ ] Typed parameters
- [ ] Optional parameters
- [ ] Default parameters
- [ ] Rest/spread parameters
- [ ] Destructured parameters

### 2. Create Parameter Queries

- [ ] **Create language-specific .scm files**:
  - `queries/parameter_type_inference.javascript.scm` - JS parameters, defaults, destructuring
  - `queries/parameter_type_inference.typescript.scm` - TS typed parameters, generics, optional
  - `queries/parameter_type_inference.python.scm` - Python type hints, *args, **kwargs
  - `queries/parameter_type_inference.rust.scm` - Rust ownership, lifetimes, patterns
- [ ] All parameter forms
- [ ] Type annotations
- [ ] Default values
- [ ] Destructuring patterns
- [ ] Language-specific patterns

### 3. Build Type Inference

- [ ] Extract explicit types
- [ ] Infer from defaults
- [ ] Handle rest parameters
- [ ] Process destructuring
- [ ] Track parameter positions

### 4. Special Cases

- [ ] Self/this parameters
- [ ] Generic type parameters
- [ ] Variadic parameters
- [ ] Named parameters (Python)
- [ ] Pattern matching (Rust)

## Expected Improvements

### Code Reduction

- **Before**: ~1,200 lines
- **After**: ~120 lines + queries
- **Reduction**: 90%

### Accuracy

- All parameter forms captured
- Proper type extraction
- Default value handling

### Performance

- Single-pass extraction
- No recursive traversal
- Efficient grouping

## Success Criteria

### Functional Requirements
- [ ] All parameter types captured
- [ ] Destructuring handled
- [ ] Defaults extracted
- [ ] Types properly inferred
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

- Uses type_tracking for type extraction
- Required by function_calls for signatures
- Integrates with symbol_resolution

## Notes

- Parameter patterns vary significantly by language
- TypeScript has the most complex parameter system
- Python uses type hints and \*args/\*\*kwargs
- Rust has ownership/mutability modifiers
- Must preserve parameter order
