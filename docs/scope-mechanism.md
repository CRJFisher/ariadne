# How the Scope Mechanism Works

This document provides a detailed explanation of how the scope resolution system works, from tree-sitter queries to symbol resolution.

## Table of Contents

1. [Overview](#overview)
2. [Tree-sitter Queries (.scm files)](#tree-sitter-queries-scm-files)
3. [Query Processing Pipeline](#query-processing-pipeline)
4. [Scope Graph Construction](#scope-graph-construction)
5. [Resolution Algorithm](#resolution-algorithm)
6. [Examples](#examples)

## Overview

The scope mechanism is a multi-stage process that transforms source code into a searchable graph structure:

```
Source Code
    ↓
Tree-sitter AST
    ↓
Query Matches (from .scm files)
    ↓
Scope Graph (nodes and edges)
    ↓
Symbol Resolution
```

## Tree-sitter Queries (.scm files)

Tree-sitter queries use a Lisp-like syntax to pattern match against the AST. The queries are stored in `.scm` files (e.g., `scopes.scm`).

### Query Syntax Basics

```scheme
;; Match a function declaration and capture its name
(function_declaration
  (identifier) @local.definition.function)

;; Match with constraints
(import_specifier 
  !alias                    ; Must NOT have an alias field
  name: (identifier) @local.import)

;; Match with multiple captures
(variable_declarator
  (identifier) @local.definition.variable
  (identifier) @local.reference)
```

### Capture Name Convention

Capture names follow a specific pattern that determines how nodes are processed:

```
@<scoping>.<node_type>.<kind>
```

- **scoping**: `local`, `hoist`, or `global`
  - `local`: Symbol is available in current scope and nested scopes
  - `hoist`: Symbol is available throughout its containing scope (function hoisting)
  - `global`: Symbol is available globally
- **node_type**: `scope`, `definition`, `import`, or `reference`
- **kind**: (optional) Symbol kind like `function`, `variable`, `class`, etc.

Examples:
- `@local.scope` - Creates a new lexical scope
- `@local.definition.function` - Defines a function in the current scope
- `@hoist.definition.function` - Defines a hoisted function
- `@local.reference` - References a symbol

### TypeScript Query Example

From `languages/typescript/scopes.scm`:

```scheme
;; Scopes
[
  (statement_block)
  (class_body)
  (arrow_function)
  (function_expression)
  (function_declaration)
] @local.scope

;; Function definitions
(function_declaration
  (identifier) @hoist.definition.function)

;; Variable definitions
(variable_declaration
  (variable_declarator . (identifier) @local.definition.variable))

;; References
(call_expression
  (identifier) @local.reference)
```

## Query Processing Pipeline

The scope resolution process follows a strict order to ensure correct graph construction:

### 1. Parse with Tree-sitter

```typescript
const parser = new Parser();
parser.setLanguage(TypeScript.tsx);
const tree = parser.parse(sourceCode);
```

### 2. Execute Queries

```typescript
const query = new Query(language, scopeQueryString);
const matches = query.matches(tree.rootNode);
```

### 3. Categorize Captures

Captures are sorted into categories based on their node type:

```typescript
const scope_captures = [];    // @*.scope
const def_captures = [];      // @*.definition.*
const import_captures = [];   // @*.import
const ref_captures = [];      // @*.reference
```

### 4. Process in Order

**Critical**: The order of processing matters!

1. **Scopes first** - Create the scope hierarchy
2. **Definitions second** - Add symbols to their scopes
3. **Imports third** - Register imported symbols
4. **References last** - Resolve references to definitions/imports

## Scope Graph Construction

The scope graph consists of nodes and edges:

### Node Types

```typescript
interface BaseNode {
  id: number;
  kind: 'scope' | 'definition' | 'reference' | 'import';
  range: Range;
}

interface Scope extends BaseNode {
  kind: 'scope';
}

interface Def extends BaseNode {
  kind: 'definition';
  name: string;
  symbol_kind: string;
}

interface Ref extends BaseNode {
  kind: 'reference';
  name: string;
  symbol_kind?: string;
}

interface Import extends BaseNode {
  kind: 'import';
  name: string;
  source_name?: string;    // For renamed imports
  source_module?: string;  // Module path
}
```

### Edge Types

```typescript
type EdgeKind = 
  | 'ScopeToScope'    // Parent-child scope relationship
  | 'DefToScope'      // Definition belongs to scope
  | 'RefToDef'        // Reference points to definition
  | 'ImportToScope'   // Import belongs to scope
  | 'RefToImport';    // Reference points to import
```

### Graph Building Algorithm

```typescript
// Simplified algorithm
function build_scope_graph(tree, config) {
  const graph = new ScopeGraph(tree.rootNode);
  
  // 1. Create scopes
  for (const scope of scope_captures) {
    graph.insert_local_scope(scope);
  }
  
  // 2. Add definitions
  for (const def of def_captures) {
    if (def.scoping === 'local') {
      graph.insert_local_def(def);
    } else if (def.scoping === 'hoist') {
      graph.insert_hoisted_def(def);
    }
  }
  
  // 3. Add imports
  for (const imp of import_captures) {
    graph.insert_local_import(imp);
  }
  
  // 4. Resolve references
  for (const ref of ref_captures) {
    graph.insert_ref(ref);
  }
  
  return graph;
}
```

## Resolution Algorithm

### Finding Definitions

The resolution algorithm walks up the scope chain looking for matching definitions:

```typescript
function resolve_ref(ref: Ref, graph: ScopeGraph): Def | Import | null {
  let current_scope = find_containing_scope(ref);
  
  while (current_scope) {
    // Check definitions in current scope
    const defs = get_defs_in_scope(current_scope);
    for (const def of defs) {
      if (def.name === ref.name) {
        return def;
      }
    }
    
    // Check imports in current scope
    const imports = get_imports_in_scope(current_scope);
    for (const imp of imports) {
      if (imp.name === ref.name) {
        return imp;
      }
    }
    
    // Move to parent scope
    current_scope = get_parent_scope(current_scope);
  }
  
  return null;
}
```

### Hoisted Definitions

Hoisted definitions (like function declarations in JavaScript) are available throughout their containing scope:

```typescript
function insert_hoisted_def(def: Def) {
  // Find the containing function/module scope
  let scope = find_containing_scope(def);
  while (scope && !is_function_or_module_scope(scope)) {
    scope = get_parent_scope(scope);
  }
  
  // Add definition to the function/module scope
  add_def_to_scope(def, scope);
}
```

### Cross-file Resolution

When a reference points to an import, the resolver looks for the export in other files:

```typescript
function resolve_import(imp: Import, file_graphs: Map<string, ScopeGraph>): Def | null {
  // Use source_name for renamed imports
  const export_name = imp.source_name || imp.name;
  
  // Search all files for matching export
  for (const [file, graph] of file_graphs) {
    const exported_def = graph.findExportedDef(export_name);
    if (exported_def) {
      return exported_def;
    }
  }
  
  return null;
}
```

## Examples

### Example 1: Simple Function Definition and Call

```typescript
function greet(name) {
  return `Hello, ${name}!`;
}

greet("World");
```

Query matches:
1. `function_declaration` → `@local.scope`
2. `greet` identifier → `@hoist.definition.function`
3. `name` parameter → `@local.definition.parameter`
4. `name` in template → `@local.reference`
5. `greet` in call → `@local.reference`

Resulting graph:
```
Root Scope
├─ greet (hoisted definition)
└─ Function Scope
   ├─ name (parameter definition)
   └─ name (reference) → points to parameter
```

### Example 2: Nested Scopes

```typescript
function outer() {
  const x = 1;
  
  function inner() {
    const y = 2;
    return x + y;  // x from outer, y from inner
  }
  
  return inner();
}
```

Resulting scope hierarchy:
```
Root Scope
└─ outer (function)
   └─ Outer Function Scope
      ├─ x (variable)
      ├─ inner (function)
      └─ Inner Function Scope
         ├─ y (variable)
         ├─ x (reference) → outer.x
         └─ y (reference) → inner.y
```

### Example 3: Import Resolution

File: `utils.ts`
```typescript
export function helper() {
  return "help";
}
```

File: `main.ts`
```typescript
import { helper as help } from './utils';
help();
```

Resolution process:
1. `help` reference in `main.ts` found
2. Resolves to import with `name: "help"`, `source_name: "helper"`
3. Searches other files for export named "helper"
4. Finds definition in `utils.ts`

## Advanced Topics

### Symbol Kinds

Symbol kinds allow filtering references by type:

```typescript
// Only match function references
(call_expression
  (identifier) @local.reference.function)
```

### Scope Predicates

Some queries use predicates to refine matches:

```typescript
// Match functions without names (anonymous)
(function_expression !name) @local.scope
```

### Performance Considerations

1. **Query Complexity**: Keep queries simple for better performance
2. **Graph Size**: Large files create large graphs - consider incremental updates
3. **Caching**: Cache parsed ASTs and graphs when possible

## Debugging Tips

1. **Visualize the AST**: Use tree-sitter playground to understand the AST structure
2. **Log Query Matches**: Print captured nodes to debug query issues
3. **Graph Inspection**: Add methods to dump the graph structure
4. **Test Small Examples**: Start with minimal code samples

## Further Reading

- [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)
- [Graph Structure Documentation](graph-structure.md)
- [Symbol Resolution Documentation](symbol-resolution.md)