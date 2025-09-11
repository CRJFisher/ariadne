# Task 11.100.18: Transform generic_resolution to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.18.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.18.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/type_analysis/generic_resolution/`
**Files**: 4+ files (~800 lines)

- `generic_resolution.ts` - Core generic type resolution
- Language-specific generic handling
- Complex type parameter tracking

## Current Implementation

### Manual Generic Resolution

```typescript
function resolve_generics(node: SyntaxNode) {
  // TypeScript generics
  if (node.type === "generic_type") {
    const name = node.childForFieldName("name");
    const typeArguments = node.childForFieldName("type_arguments");

    const typeParams = [];
    if (typeArguments) {
      for (const arg of typeArguments.children) {
        if (arg.type === "type_identifier") {
          typeParams.push(arg.text);
        }
      }
    }

    return {
      genericType: name.text,
      typeParameters: typeParams,
      resolved: resolveTypeParameters(name.text, typeParams),
    };
  }

  // Function with type parameters
  else if (node.type === "function_declaration") {
    const typeParams = node.childForFieldName("type_parameters");
    if (typeParams) {
      const params = extractTypeParameters(typeParams);
      const body = node.childForFieldName("body");

      // Track type parameter usage in body
      return trackTypeParameterUsage(params, body);
    }
  }
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; generic_resolution_queries.scm

;; TypeScript generic type parameters
(function_declaration
  name: (identifier) @generic.function.name
  type_parameters: (type_parameters
    (type_parameter
      (type_identifier) @generic.param.name
      constraint: (_)? @generic.param.constraint))) @generic.function

;; Generic class declaration
(class_declaration
  name: (identifier) @generic.class.name
  type_parameters: (type_parameters
    (type_parameter
      (type_identifier) @generic.param))) @generic.class

;; Generic interface
(interface_declaration
  name: (type_identifier) @generic.interface.name
  type_parameters: (type_parameters
    (type_parameter
      (type_identifier) @generic.param))) @generic.interface

;; Generic type instantiation
(generic_type
  (type_identifier) @generic.type.name
  type_arguments: (type_arguments
    (_) @generic.arg)) @generic.instantiation

;; Conditional types
(conditional_type
  check_type: (_) @generic.conditional.check
  extends_type: (_) @generic.conditional.extends
  true_type: (_) @generic.conditional.true
  false_type: (_) @generic.conditional.false) @generic.conditional

;; Mapped types
(mapped_type_clause
  (type_parameter
    (type_identifier) @generic.mapped.param
    constraint: (_) @generic.mapped.constraint)) @generic.mapped

;; Python generic (PEP 484)
(class_definition
  name: (identifier) @generic.class.name
  superclasses: (argument_list
    (subscript
      value: (identifier) @generic.base
      (#match? @generic.base "Generic|TypeVar")
      subscript: (_) @generic.param))) @generic.python

;; Python TypeVar
(assignment
  left: (identifier) @generic.typevar.name
  right: (call
    function: (identifier) @generic.typevar.func
    (#eq? @generic.typevar.func "TypeVar")
    arguments: (argument_list
      (string) @generic.typevar.bound))) @generic.python.typevar

;; Rust generic parameters
(function_item
  name: (identifier) @generic.function.name
  type_parameters: (type_parameters
    (type_parameter
      (type_identifier) @generic.param
      bounds: (trait_bounds
        (type_identifier) @generic.bound)?))) @generic.rust

;; Rust lifetime parameters
(function_item
  type_parameters: (type_parameters
    (lifetime
      (identifier) @generic.lifetime))) @generic.rust.lifetime

;; Rust associated types
(associated_type
  name: (type_identifier) @generic.associated.name
  type_parameters: (type_parameters)? @generic.associated.params
  bounds: (trait_bounds)? @generic.associated.bounds) @generic.rust.associated

;; Generic constraints/bounds
(type_parameter
  (type_identifier) @generic.param.name
  "extends" @generic.extends
  (_) @generic.constraint) @generic.constrained

;; Default type parameters
(type_parameter
  (type_identifier) @generic.param.name
  "=" @generic.default.eq
  (_) @generic.default.value) @generic.default

;; Inferred type parameters
(call_expression
  function: (identifier) @generic.call.function
  type_arguments: (type_arguments
    (_) @generic.call.arg)?) @generic.call
```

### New Implementation

```typescript
export function resolve_generics_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): GenericResolution {
  const query = loadGenericQuery(language);
  const captures = query.captures(tree.rootNode);

  const resolution: GenericResolution = {
    declarations: new Map(),
    instantiations: [],
    constraints: new Map(),
    resolutions: new Map(),
  };

  // Process generic declarations
  const declarations = captures.filter(
    (c) =>
      c.name.includes("generic.function") ||
      c.name.includes("generic.class") ||
      c.name.includes("generic.interface")
  );

  for (const declGroup of groupByDeclaration(declarations)) {
    const decl = extractGenericDeclaration(declGroup);
    resolution.declarations.set(decl.name, decl);
  }

  // Process generic instantiations
  const instantiations = captures.filter(
    (c) =>
      c.name.includes("generic.instantiation") ||
      c.name.includes("generic.call")
  );

  for (const instGroup of groupByInstantiation(instantiations)) {
    const inst = extractInstantiation(instGroup);
    resolution.instantiations.push(inst);

    // Resolve type arguments
    resolveTypeArguments(inst, resolution);
  }

  return resolution;
}

function extractGenericDeclaration(group: QueryCapture[]): GenericDeclaration {
  const name =
    group.find((c) => c.name.includes(".name"))?.node.text || "unknown";

  const params = group
    .filter((c) => c.name.includes(".param") && !c.name.includes(".constraint"))
    .map((c) => c.node.text);

  const constraints = new Map<string, string>();

  // Extract parameter constraints
  const constrainedParams = groupByParameter(
    group.filter((c) => c.name.includes(".param"))
  );

  for (const [param, captures] of constrainedParams) {
    const constraint = captures.find((c) => c.name.includes(".constraint"))
      ?.node.text;

    if (constraint) {
      constraints.set(param, constraint);
    }
  }

  return {
    name,
    typeParameters: params,
    constraints,
    defaults: extractDefaults(group),
    location: group[0].node.startPosition,
  };
}

function resolveTypeArguments(
  instantiation: GenericInstantiation,
  resolution: GenericResolution
): void {
  const declaration = resolution.declarations.get(instantiation.genericType);

  if (!declaration) return;

  const resolved = new Map<string, string>();

  // Map type parameters to arguments
  declaration.typeParameters.forEach((param, index) => {
    const arg = instantiation.typeArguments[index];

    if (arg) {
      // Check constraint satisfaction
      const constraint = declaration.constraints.get(param);
      if (constraint && !satisfiesConstraint(arg, constraint)) {
        instantiation.errors = instantiation.errors || [];
        instantiation.errors.push(
          `Type '${arg}' does not satisfy constraint '${constraint}'`
        );
      }

      resolved.set(param, arg);
    } else {
      // Use default if available
      const defaultType = declaration.defaults?.get(param);
      if (defaultType) {
        resolved.set(param, defaultType);
      }
    }
  });

  resolution.resolutions.set(instantiation, resolved);
}
```

## Transformation Steps

### 1. Document Generic Patterns

- [ ] Type parameters
- [ ] Type arguments
- [ ] Constraints/bounds
- [ ] Default parameters
- [ ] Conditional types
- [ ] Mapped types

### 2. Create Generic Queries

- [ ] **Create language-specific .scm files**:
  - `queries/generic_resolution.javascript.scm` - JS generics (limited), template types
  - `queries/generic_resolution.typescript.scm` - TS generics, constraints, mapped types
  - `queries/generic_resolution.python.scm` - Python TypeVar, Generic, type variables
  - `queries/generic_resolution.rust.scm` - Rust generics, lifetimes, trait bounds
- [ ] Declaration patterns
- [ ] Instantiation patterns
- [ ] Constraint patterns
- [ ] Language-specific forms

### 3. Build Resolution System

- [ ] Extract declarations
- [ ] Track instantiations
- [ ] Resolve type arguments
- [ ] Verify constraints

### 4. Special Cases

- [ ] Variance (in/out)
- [ ] Higher-kinded types
- [ ] Associated types (Rust)
- [ ] Lifetime parameters (Rust)
- [ ] Type inference

## Expected Improvements

### Code Reduction

- **Before**: ~800 lines
- **After**: ~100 lines + queries
- **Reduction**: 87%

### Accuracy

- Complete generic tracking
- Constraint verification
- Default handling

### Performance

- Single-pass extraction
- Efficient resolution
- Fast constraint checking

## Success Criteria

### Functional Requirements
- [ ] All generics tracked
- [ ] Constraints verified
- [ ] Type arguments resolved
- [ ] 85%+ code reduction
- [ ] Error detection

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

- Related to type_tracking for type info
- Used by type_propagation for generic types
- Important for interface_implementation

## Notes

- Generics are complex in TypeScript
- Python uses TypeVar and Generic
- Rust has lifetimes and associated types
- Must handle variance correctly
- Type inference adds complexity
