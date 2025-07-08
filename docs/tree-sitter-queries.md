# Tree-sitter Queries Guide

This guide explains how to write and understand tree-sitter queries (`.scm` files) for the scope resolution system.

## Table of Contents

1. [Query Basics](#query-basics)
2. [Capture Naming Convention](#capture-naming-convention)
3. [Writing Queries](#writing-queries)
4. [Common Patterns](#common-patterns)
5. [TypeScript Query Examples](#typescript-query-examples)
6. [Debugging Queries](#debugging-queries)
7. [Best Practices](#best-practices)

## Query Basics

Tree-sitter queries use an S-expression syntax to match patterns in the AST.

### Basic Syntax

```scheme
;; Match a node type
(function_declaration)

;; Match and capture
(function_declaration) @capture_name

;; Match with child
(function_declaration
  (identifier))

;; Match and capture child
(function_declaration
  (identifier) @function_name)

;; Match with field names
(function_declaration
  name: (identifier) @function_name)
```

### Node Types

Node types come from the grammar. Common TypeScript node types:

- `function_declaration`
- `variable_declaration`
- `identifier`
- `class_declaration`
- `method_definition`
- `import_statement`
- `export_statement`

### Fields

Many nodes have named fields:

```scheme
;; function has 'name' and 'parameters' fields
(function_declaration
  name: (identifier) @name
  parameters: (formal_parameters))

;; import specifier has 'name' and 'alias' fields  
(import_specifier
  name: (identifier) @source
  alias: (identifier) @local)
```

## Capture Naming Convention

The system uses a specific naming convention for captures:

```
@<scoping>.<node_type>.<kind>
```

### Scoping Types

- **`local`**: Symbol is available in current and nested scopes
- **`hoist`**: Symbol is hoisted to function/module scope
- **`global`**: Symbol is globally available

### Node Types

- **`scope`**: Creates a new lexical scope
- **`definition`**: Defines a new symbol
- **`reference`**: Uses an existing symbol
- **`import`**: Imports a symbol from another module

### Symbol Kinds

Used with definitions and references:
- `function`
- `variable`
- `constant`
- `class`
- `interface`
- `type`
- `parameter`
- etc.

### Examples

```scheme
@local.scope              ;; New lexical scope
@local.definition.function ;; Function definition
@hoist.definition.function ;; Hoisted function
@local.reference          ;; Generic reference
@local.reference.function ;; Function reference
@local.import             ;; Import statement
```

## Writing Queries

### Step 1: Understand the AST

Use the tree-sitter playground or CLI to inspect the AST:

```bash
# Using tree-sitter CLI
tree-sitter parse example.ts

# Output shows AST structure
(program
  (function_declaration
    name: (identifier)
    parameters: (formal_parameters
      (required_parameter
        pattern: (identifier)))
    body: (statement_block)))
```

### Step 2: Identify Patterns

Determine what constitutes:
- Scopes (function bodies, blocks, etc.)
- Definitions (variable declarations, functions, etc.)
- References (identifier usage)
- Imports/exports

### Step 3: Write Queries

Start with simple patterns and build up:

```scheme
;; 1. Start with scopes
(statement_block) @local.scope
(function_declaration) @local.scope

;; 2. Add definitions
(function_declaration
  name: (identifier) @hoist.definition.function)

;; 3. Add references
(call_expression
  function: (identifier) @local.reference)
```

## Common Patterns

### Alternation

Match multiple node types:

```scheme
;; Multiple scope types
[
  (statement_block)
  (class_body)
  (function_declaration)
  (arrow_function)
] @local.scope
```

### Negation

Match nodes without certain fields:

```scheme
;; Anonymous functions (no name field)
(function_expression !name) @local.scope

;; Non-renamed imports (no alias)
(import_specifier !alias
  name: (identifier) @local.import)
```

### Nested Patterns

Match deeply nested structures:

```scheme
;; Object method
(object
  (pair
    key: (property_identifier) @method_name
    value: (function_expression) @local.scope))
```

### Wildcards

Match any node:

```scheme
;; Any node between function and identifier
(function_declaration
  (_)
  (identifier) @name)
```

### Predicates

Apply additional constraints:

```scheme
;; Only specific identifiers
((identifier) @special
 (#eq? @special "require"))
```

## TypeScript Query Examples

### Function Declarations

```scheme
;; Regular function
(function_declaration
  name: (identifier) @hoist.definition.function)

;; Generator function
(generator_function_declaration
  name: (identifier) @hoist.definition.generator)

;; Method in class
(method_definition
  name: (property_identifier) @local.definition.method)

;; Arrow function assigned to variable
(variable_declarator
  name: (identifier) @local.definition.function
  value: (arrow_function))
```

### Variable Declarations

```scheme
;; var declarations (function scoped)
(variable_declaration
  (variable_declarator
    name: (identifier) @hoist.definition.variable))

;; let declarations (block scoped)
(lexical_declaration
  kind: "let"
  (variable_declarator
    name: (identifier) @local.definition.variable))

;; const declarations
(lexical_declaration
  kind: "const"
  (variable_declarator
    name: (identifier) @local.definition.constant))
```

### Pattern Matching

```scheme
;; Destructuring in parameters
(formal_parameters
  (required_parameter
    pattern: (object_pattern
      (shorthand_property_identifier_pattern) @local.definition.parameter)))

;; Array destructuring
(variable_declarator
  name: (array_pattern
    (identifier) @local.definition.variable))

;; Rest parameters
(formal_parameters
  (rest_pattern
    (identifier) @local.definition.parameter))
```

### Imports and Exports

```scheme
;; Named imports
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @local.import))))

;; Renamed imports
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @_source
        alias: (identifier) @local.import.renamed))))

;; Default import
(import_statement
  (import_clause
    (identifier) @local.import))

;; Named exports
(export_statement
  (export_clause
    (export_specifier
      name: (identifier) @local.reference)))
```

### Type Definitions

```scheme
;; Type alias
(type_alias_declaration
  name: (type_identifier) @local.definition.type)

;; Interface
(interface_declaration
  name: (type_identifier) @local.definition.interface)

;; Type parameters
(type_parameters
  (type_parameter
    (type_identifier) @local.definition))
```

### References

```scheme
;; Function calls
(call_expression
  function: (identifier) @local.reference)

;; Property access
(member_expression
  object: (identifier) @local.reference)

;; Type references
(type_annotation
  (type_identifier) @local.reference)

;; JSX elements
(jsx_opening_element
  name: (identifier) @local.reference)
```

## Debugging Queries

### Using Tree-sitter Playground

The [Tree-sitter Playground](https://tree-sitter.github.io/tree-sitter/playground) is invaluable for testing queries:

1. Paste your code
2. Select the language
3. Write queries and see matches highlighted

### Logging Matches

Add debug output to scope-resolution.ts:

```typescript
for (const match of matches) {
  console.log(`Pattern ${match.pattern}:`);
  for (const capture of match.captures) {
    console.log(`  ${capture.name}: "${capture.node.text}" at ${capture.node.startPosition}`);
  }
}
```

### Common Issues

1. **No matches**: Check node types match grammar exactly
2. **Too many matches**: Add constraints or use more specific patterns
3. **Wrong captures**: Verify field names and nesting
4. **Order matters**: Ensure queries process in correct order

### Query Testing Strategy

1. Start with minimal code sample
2. Write query for one pattern
3. Test and verify matches
4. Gradually add complexity
5. Test edge cases

## Best Practices

### 1. Keep Queries Simple

Break complex patterns into multiple simple queries:

```scheme
;; Bad: Too complex
(function_declaration
  name: (identifier) @name
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @param))
  body: (statement_block
    (return_statement
      (identifier) @ref))) @scope

;; Good: Separate concerns
(function_declaration) @local.scope
(function_declaration
  name: (identifier) @hoist.definition.function)
(formal_parameters
  (required_parameter
    pattern: (identifier) @local.definition.parameter))
(return_statement
  (identifier) @local.reference)
```

### 2. Use Field Names

Field names make queries more readable and precise:

```scheme
;; Less clear
(import_specifier
  (identifier)
  (identifier) @local.import)

;; Clearer
(import_specifier
  name: (identifier)
  alias: (identifier) @local.import)
```

### 3. Comment Complex Patterns

Document why certain patterns exist:

```scheme
;; Handle renamed imports specially to capture source name
(import_specifier
  alias: (identifier) @local.import.renamed)

;; Property signatures create sealed scopes to prevent
;; parameter definitions from leaking
(property_signature) @local.scope
```

### 4. Test Edge Cases

Consider:
- Anonymous functions
- Destructuring patterns
- Default parameters
- Computed property names
- Dynamic imports

### 5. Performance Considerations

- Avoid overly broad patterns
- Use specific node types when possible
- Minimize backtracking with clear patterns

## Language-Specific Considerations

### TypeScript vs JavaScript

TypeScript adds many node types:
- Type annotations
- Interfaces
- Type parameters
- Decorators
- Enums

Ensure queries handle both when appropriate:

```scheme
;; Handle both JS and TS
[
  (function_declaration)
  (function_signature)  ;; TS only
] @local.scope
```

### JSX/TSX

JSX adds additional node types:
- `jsx_element`
- `jsx_opening_element`
- `jsx_self_closing_element`
- `jsx_expression`

```scheme
;; JSX component usage
(jsx_opening_element
  name: (identifier) @local.reference)
```

## Advanced Techniques

### Contextual Patterns

Match based on context:

```scheme
;; Only in certain positions
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @exported_var)))
```

### Capturing Metadata

Use multiple captures for additional info:

```scheme
;; Capture both names in renamed import
(import_specifier
  name: (identifier) @source_name
  alias: (identifier) @local.import.renamed)
```

### Custom Predicates

Some tree-sitter implementations support custom predicates:

```scheme
;; Hypothetical: match specific string content
((string) @path
 (#match? @path "^\\./"))
```

## Examples Repository

For more examples, see:
- [TypeScript queries](../src/languages/typescript/scopes.scm)
- [Tree-sitter TypeScript grammar](https://github.com/tree-sitter/tree-sitter-typescript)
- [Tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/)

## Further Reading

- [Scope Mechanism Documentation](scope-mechanism.md)
- [Language Configuration](language-configuration.md)
- [Tree-sitter Query Syntax Reference](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)