# JavaScript Language Support

This directory contains the tree-sitter query files and configuration for JavaScript language support in the TypeScript port of bloop's code intelligence.

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

Both approaches achieve the same goal: identifying anonymous functions that create their own scope.

### Why This Works

In the tree-sitter-javascript grammar:
- `function_declaration` - Named functions: `function foo() {}`
- `function_expression` - Anonymous functions: `function() {}` or `const foo = function() {}`

By explicitly matching `function_expression`, we capture all anonymous function cases that the original `(function !name)` pattern was designed to match.

This change maintains semantic compatibility while working within the constraints of the JavaScript tree-sitter bindings.