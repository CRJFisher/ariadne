# Task 11.100.13: Transform method_override to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.13.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.13.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/inheritance/method_override/`
**Files**: 4+ files (~800 lines)

- `method_override.ts` - Core override detection
- `language_configs.ts` - Language-specific patterns
- Already partially uses configuration pattern
- Some query usage but mostly manual

## Current Implementation

### Hybrid Manual/Query Approach

```typescript
function detect_method_override(node: SyntaxNode) {
  // Currently uses some queries but mostly manual
  if (node.type === "method_definition") {
    const methodName = node.childForFieldName("name");
    const className = findEnclosingClass(node);

    // Check parent classes for same method
    const parentClasses = getParentClasses(className);
    for (const parent of parentClasses) {
      if (hasMethod(parent, methodName.text)) {
        return {
          method: methodName.text,
          class: className,
          overrides: parent,
          hasSuper: checkForSuperCall(node),
        };
      }
    }
  }
}

function checkForSuperCall(methodNode: SyntaxNode): boolean {
  // Manual traversal to find super calls
  function traverse(node: SyntaxNode): boolean {
    if (node.type === "call_expression") {
      const func = node.childForFieldName("function");
      if (func.type === "super") {
        return true;
      }
    }
    for (const child of node.children) {
      if (traverse(child)) return true;
    }
    return false;
  }
  return traverse(methodNode);
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; method_override_queries.scm

;; Method definitions in classes
(class_body
  (method_definition
    name: (property_identifier) @override.method.name
    parameters: (formal_parameters) @override.method.params
    body: (statement_block) @override.method.body)) @override.method

;; TypeScript override keyword
(class_body
  (method_definition
    "override" @override.explicit
    name: (property_identifier) @override.method.name)) @override.explicit.typescript

;; Python method override with decorators
(class_definition
  name: (identifier) @override.class.name
  body: (block
    (decorated_definition
      (decorator_list
        (decorator
          (identifier) @override.decorator
          (#match? @override.decorator "override|property|staticmethod|classmethod")))
      (function_definition
        name: (identifier) @override.method.name)))) @override.decorated.python

;; Super calls in methods
(method_definition
  name: (property_identifier) @override.method.name
  body: (statement_block
    (expression_statement
      (call_expression
        function: (member_expression
          object: (super) @override.super
          property: (property_identifier) @override.super.method))))) @override.with_super

;; Python super() calls
(function_definition
  name: (identifier) @override.method.name
  body: (block
    (expression_statement
      (call
        function: (identifier) @override.super.call
        (#eq? @override.super.call "super"))))) @override.python.super

;; Rust trait method implementation
(impl_item
  trait: (type_identifier) @override.trait
  type: (type_identifier) @override.struct
  body: (declaration_list
    (function_item
      name: (identifier) @override.method.name))) @override.rust.trait_impl

;; Abstract method implementation
(class_body
  (method_definition
    abstract: "abstract" @override.abstract.marker
    name: (property_identifier) @override.abstract.name)) @override.abstract

;; Virtual method patterns (C++ style comments)
(method_definition
  (comment) @override.virtual.comment
  (#match? @override.virtual.comment "virtual|override")
  name: (property_identifier) @override.virtual.name) @override.virtual

;; Method signature comparison
(method_definition
  name: (property_identifier) @override.signature.name
  parameters: (formal_parameters
    (_) @override.signature.param)) @override.signature

;; Static method override
(class_body
  (method_definition
    "static" @override.static
    name: (property_identifier) @override.static.name)) @override.static.method

;; Getter/setter override
(class_body
  (method_definition
    "get" @override.getter
    name: (property_identifier) @override.getter.name)) @override.getter.method

(class_body
  (method_definition
    "set" @override.setter
    name: (property_identifier) @override.setter.name)) @override.setter.method
```

### New Implementation

```typescript
export function detect_method_overrides_with_queries(
  tree: Parser.Tree,
  source_code: string,
  hierarchy: ClassHierarchy,
  language: Language
): MethodOverrideInfo[] {
  const query = loadOverrideQuery(language);
  const captures = query.captures(tree.rootNode);

  // Group methods by class
  const classMethods = groupMethodsByClass(captures);
  const overrides: MethodOverrideInfo[] = [];

  for (const [className, methods] of classMethods) {
    // Get parent classes from hierarchy
    const parents = hierarchy.getParents(className);

    for (const method of methods) {
      const methodName = extractMethodName(method);
      const signature = extractMethodSignature(method);

      // Check if any parent has this method
      for (const parent of parents) {
        const parentMethods = classMethods.get(parent) || [];
        const parentMethod = findMatchingMethod(
          parentMethods,
          methodName,
          signature
        );

        if (parentMethod) {
          overrides.push({
            class: className,
            method: methodName,
            overrides: parent,
            signature: signature,
            hasExplicitOverride: hasOverrideKeyword(method),
            callsSuper: detectsSuperCall(method),
            isAbstract: isAbstractMethod(parentMethod),
            location: method[0].node.startPosition,
          });
        }
      }
    }
  }

  return overrides;
}

function detectsSuperCall(methodGroup: QueryCapture[]): boolean {
  return methodGroup.some(
    (c) => c.name.includes(".super") || c.name.includes(".super.call")
  );
}

function findMatchingMethod(
  methods: MethodGroup[],
  name: string,
  signature: MethodSignature
): MethodGroup | null {
  return (
    methods.find((m) => {
      const mName = extractMethodName(m);
      const mSig = extractMethodSignature(m);

      return mName === name && signaturesMatch(signature, mSig);
    }) || null
  );
}

function signaturesMatch(
  sig1: MethodSignature,
  sig2: MethodSignature
): boolean {
  // Compare parameter counts and types
  return (
    sig1.paramCount === sig2.paramCount &&
    sig1.paramTypes.every(
      (t, i) =>
        t === sig2.paramTypes[i] || t === "any" || sig2.paramTypes[i] === "any"
    )
  );
}
```

## Transformation Steps

### 0. Migrate Functions from code_graph.ts [COMPLETED]

**STATUS**: ✅ The function `detect_and_validate_method_overrides` has been successfully moved to `method_override/method_override.ts`.

**Type Cleanup Requirements**:
- Only the output type `MethodOverrideMap` needs to remain public in `packages/types`
- All internal AST processing types should be DELETED from the types package (not deprecated)
- Types like `MethodOverrideContext` that are only used internally for AST traversal should be made local to the module or removed with query-based approach

### 1. Document Override Patterns

- [ ] Explicit override keywords
- [ ] Implicit overrides
- [ ] Super/parent calls
- [ ] Abstract implementations
- [ ] Virtual methods
- [ ] Signature matching

### 2. Create Override Queries

- [ ] **Create language-specific .scm files**:
  - `queries/method_override.javascript.scm` - JS class methods, super calls
  - `queries/method_override.typescript.scm` - TS override keyword, abstract methods
  - `queries/method_override.python.scm` - Python methods, super(), decorators
  - `queries/method_override.rust.scm` - Rust trait implementations, associated functions
- [ ] Method definitions in classes
- [ ] Override markers/keywords
- [ ] Super call detection
- [ ] Signature extraction
- [ ] Decorator patterns

### 3. Build Override Detection

- [ ] Match methods to parents
- [ ] Compare signatures
- [ ] Detect super calls
- [ ] Track override chains

### 4. Special Cases

- [ ] Property overrides
- [ ] Static method overrides
- [ ] Constructor overrides
- [ ] Operator overloading
- [ ] Trait implementations

## Expected Improvements

### Code Reduction

- **Before**: ~800 lines
- **After**: ~100 lines + queries
- **Reduction**: 87%

### Accuracy

- Better signature matching
- Complete super call detection
- All override patterns captured

### Performance

- Single-pass method collection
- Efficient hierarchy traversal
- Fast signature comparison

## Success Criteria

### Functional Requirements
- [ ] All overrides detected
- [ ] Super calls tracked
- [ ] Signatures compared correctly
- [ ] 85%+ code reduction
- [ ] No false positives

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

- Requires class_hierarchy for inheritance info
- Requires method_calls for super call detection
- Used by type_analysis for method resolution

## Notes

- Module already uses some configuration patterns
- Has partial query support but mostly manual
- TypeScript has explicit override keyword
- Python uses naming conventions
- Must match method signatures accurately
