# TypeScript Language Support

This directory contains the tree-sitter query files and configuration for TypeScript language support in the TypeScript port of bloop's code intelligence.

## Query Syntax Differences from Bloop

### Negated Field Syntax

The original Rust implementation uses tree-sitter's negated field syntax:
```scheme
;; Original bloop query
(function !name)  ;; Matches functions without a name field
```

This syntax is not supported in the JavaScript tree-sitter bindings. We've replaced it with:

```scheme
;; TypeScript implementation
(function_expression)  ;; Matches anonymous function expressions
```

### Import Specifier Aliases

The original also uses negated syntax for import specifiers:

```scheme
;; Original bloop query
(import_specifier !alias (identifier) @local.import)
```

This would need similar adaptation if we implement import tracking features.

### Why This Works

TypeScript inherits JavaScript's grammar with extensions. The same logic applies:

- `function_declaration` - Named functions: `function foo(): void {}`
- `function_expression` - Anonymous functions: `function(): void {}` or `const foo = function(): void {}`

By explicitly matching `function_expression`, we capture all anonymous function cases while maintaining compatibility with the JavaScript tree-sitter bindings.