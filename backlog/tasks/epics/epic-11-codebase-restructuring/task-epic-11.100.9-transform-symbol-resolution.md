# Task 11.100.9: Transform symbol_resolution to Tree-sitter Queries

## Parent Task

11.100 - Transform Entire Codebase to Tree-sitter Query System

## Required Subtasks

**CRITICAL**: These subtasks must be completed before implementation begins:

- [ ] **Task 11.100.9.1** - Test Overhaul for this module
  - Achieve 100% test coverage
  - Ensure all tests pass before transformation
  - Validate query-based implementation matches manual implementation

- [ ] **Task 11.100.9.2** - TypeScript Compliance for this module
  - Achieve zero TypeScript compilation errors
  - Ensure strict type safety throughout transformation
  - Maintain IntelliSense support

## Module Overview

**Location**: `src/scope_analysis/symbol_resolution/`
**Files**: 6+ files (~2,000 lines)

- `symbol_resolution.ts` - Core symbol resolver
- `symbol_resolution.javascript.ts` - JS symbol patterns
- `symbol_resolution.typescript.ts` - TS symbol resolution
- `symbol_resolution.python.ts` - Python symbol lookup
- `symbol_resolution.rust.ts` - Rust symbol resolution
- Recently refactored to configuration pattern but still manual

## Current Implementation

### Manual Symbol Resolution

```typescript
function resolve_symbol(node: SyntaxNode, name: string) {
  // Walk up the scope tree
  let current = node.parent;
  while (current) {
    // Check local variables
    if (current.type === "variable_declaration") {
      const declarator = current.childForFieldName("declarator");
      if (getVariableName(declarator) === name) {
        return { type: "local", node: declarator };
      }
    }

    // Check function parameters
    else if (current.type === "function_declaration") {
      const params = current.childForFieldName("parameters");
      if (hasParameter(params, name)) {
        return { type: "parameter", node: params };
      }
    }

    // Check class members
    else if (current.type === "class_declaration") {
      const body = current.childForFieldName("body");
      if (hasClassMember(body, name)) {
        return { type: "member", node: body };
      }
    }

    current = current.parent;
  }

  // Check imports
  return checkImports(name);
}
```

## Query-Based Implementation

### Tree-sitter Query Pattern

```scheme
;; symbol_resolution_queries.scm

;; Local variable definitions
(variable_declarator
  name: (identifier) @symbol.local.name) @symbol.local
  (#set! "symbol.type" "local_variable")

(lexical_declaration
  (variable_declarator
    name: (identifier) @symbol.local.name)) @symbol.local.declaration

;; Function parameters
(function_declaration
  parameters: (formal_parameters
    (identifier) @symbol.param.name)) @symbol.param
  (#set! "symbol.type" "parameter")

(arrow_function
  parameters: (identifier) @symbol.param.name) @symbol.param.single

;; Destructured parameters
(formal_parameters
  (object_pattern
    (shorthand_property_identifier_pattern) @symbol.param.destructured))

;; Class members
(class_declaration
  name: (identifier) @symbol.class.name
  body: (class_body
    (method_definition
      name: (property_identifier) @symbol.member.method)))

(class_body
  (field_definition
    property: (property_identifier) @symbol.member.field))

;; Import bindings
(import_specifier
  (identifier) @symbol.import.default
  alias: (identifier)? @symbol.import.alias) @symbol.import

(namespace_import
  (identifier) @symbol.import.namespace) @symbol.import.star

;; Python symbols
(function_definition
  name: (identifier) @symbol.function.name
  parameters: (parameters
    (identifier) @symbol.param.name)) @symbol.function.python

(assignment
  left: (identifier) @symbol.local.name) @symbol.assignment.python

;; Python class attributes
(class_definition
  name: (identifier) @symbol.class.name
  body: (block
    (expression_statement
      (assignment
        left: (attribute
          object: (identifier) @symbol.self
          (#eq? @symbol.self "self")
          attribute: (identifier) @symbol.member.attribute)))))

;; Rust symbols
(let_declaration
  pattern: (identifier) @symbol.local.name) @symbol.local.rust

(function_item
  name: (identifier) @symbol.function.name
  parameters: (parameters
    (parameter
      pattern: (identifier) @symbol.param.name))) @symbol.function.rust

;; Rust use statements
(use_declaration
  argument: (scoped_identifier
    name: (identifier) @symbol.import.name)) @symbol.import.rust

;; Symbol references (for resolution)
(identifier) @symbol.reference
  (#not-parent-type? @symbol.reference variable_declarator)
  (#not-parent-type? @symbol.reference function_declaration)
  (#not-parent-type? @symbol.reference class_declaration)
```

### New Implementation

```typescript
export function resolve_symbols_with_queries(
  tree: Parser.Tree,
  source_code: string,
  language: Language
): SymbolResolutionMap {
  const query = loadSymbolQuery(language);
  const captures = query.captures(tree.rootNode);

  // Build symbol definition map
  const definitions = new Map<string, SymbolDefinition[]>();

  // Process all symbol definitions
  const defCaptures = captures.filter((c) => !c.name.includes(".reference"));

  for (const capture of defCaptures) {
    const symbolName = extractSymbolName(capture);
    const symbolType = getSymbolType(capture);
    const scope = findEnclosingScope(capture.node);

    if (!definitions.has(symbolName)) {
      definitions.set(symbolName, []);
    }

    definitions.get(symbolName)!.push({
      name: symbolName,
      type: symbolType,
      scope: scope,
      node: capture.node,
      location: capture.node.startPosition,
    });
  }

  // Process references and resolve them
  const references = captures.filter((c) => c.name.includes(".reference"));

  const resolutions = new Map<SyntaxNode, SymbolDefinition>();

  for (const ref of references) {
    const name = ref.node.text;
    const resolution = resolveInScope(name, ref.node, definitions);

    if (resolution) {
      resolutions.set(ref.node, resolution);
    }
  }

  return {
    definitions,
    resolutions,
    unresolved: findUnresolvedSymbols(references, resolutions),
  };
}

function resolveInScope(
  name: string,
  referenceNode: SyntaxNode,
  definitions: Map<string, SymbolDefinition[]>
): SymbolDefinition | null {
  const candidates = definitions.get(name) || [];

  // Find the closest definition in scope
  return (
    candidates
      .filter((def) => isInScope(referenceNode, def.scope))
      .sort(
        (a, b) =>
          scopeDistance(referenceNode, a.scope) -
          scopeDistance(referenceNode, b.scope)
      )[0] || null
  );
}
```

## Transformation Steps

### 0. Migrate Functions from file_analyzer.ts and code_graph.ts [COMPLETED]

**STATUS**: ✅ The following functions have been successfully migrated:
- `build_symbol_registry` - Moved from file_analyzer.ts to symbol_resolution.ts
- `build_symbol_index` - Moved from code_graph.ts to symbol_resolution.ts

**Type Cleanup Requirements**:
- Only the output types `SymbolRegistry` and `SymbolIndex` need to remain public in `packages/types`
- All internal AST processing types should be DELETED from the types package (not deprecated)
- Types that are only used internally for AST traversal (like intermediate symbol resolution types) should be made local to the module or removed with query-based approach

### 1. Document Symbol Patterns

- [ ] Local variables (all declaration forms)
- [ ] Function/method parameters
- [ ] Class members (fields, methods)
- [ ] Import bindings
- [ ] Global symbols
- [ ] Nested scopes

### 2. Create Symbol Queries

- [ ] **Create language-specific .scm files**:
  - `queries/symbol_resolution.javascript.scm` - JS var/let/const, function params, hoisting
  - `queries/symbol_resolution.typescript.scm` - TS types, interfaces, namespaces
  - `queries/symbol_resolution.python.scm` - Python scope rules, global/nonlocal
  - `queries/symbol_resolution.rust.scm` - Rust ownership, lifetimes, modules
- [ ] Definition patterns for all symbol types
- [ ] Reference patterns
- [ ] Scope boundary markers
- [ ] Language-specific patterns

### 3. Build Resolution Engine

- [ ] Create symbol definition map
- [ ] Implement scope hierarchy
- [ ] Resolve references to definitions
- [ ] Handle shadowing correctly

### 4. Handle Special Cases

- [ ] Hoisted declarations (JS)
- [ ] Destructuring patterns
- [ ] Namespace imports
- [ ] Type vs value namespaces (TS)

## Expected Improvements

### Code Reduction

- **Before**: ~2,000 lines
- **After**: ~200 lines + queries
- **Reduction**: 90%

### Performance

- Single-pass symbol collection
- No recursive tree walking
- O(1) symbol lookup

### Accuracy

- Consistent scope rules
- Proper shadowing handling
- Complete symbol coverage

## Success Criteria

### Functional Requirements
- [ ] All symbol types captured
- [ ] Correct scope resolution
- [ ] Shadowing handled properly
- [ ] 90% code reduction
- [ ] Performance improvement

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

- Requires scope_tree for scope boundaries
- Used by type_tracking for symbol types
- Critical for call_graph analysis

## Notes

- Symbol resolution is fundamental to many analyses
- Must handle lexical scoping correctly
- JavaScript hoisting adds complexity
- TypeScript has separate type/value namespaces
- Recently refactored but still uses manual traversal
