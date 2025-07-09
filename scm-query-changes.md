# Tree-sitter Query Language Changes from Bloop

## Summary

During the porting of the tree-sitter based code intelligence from Rust (bloop) to TypeScript, we discovered that the `.scm` query files needed modifications to work correctly with the tree-sitter JavaScript bindings.

## Key Change: Function Expression Query Syntax

### Original Bloop Query (Rust)
```scheme
;; nameless functions create scopes, just like arrow functions
(function !name)
```

### Updated TypeScript Implementation
```scheme
;; anonymous function expressions create scopes, just like arrow functions
(function_expression)
```

## Why This Change Was Necessary

1. **Query Syntax Error**: The syntax `(function !name)` caused a parse error in the tree-sitter JavaScript bindings:
   ```
   Query error at line 9, column 16: Expected closing parenthesis
   ```

2. **Negated Field Syntax Not Supported**: The `!name` syntax is a valid tree-sitter query feature (negated fields) that matches nodes lacking a specific field. While this works in the Rust tree-sitter implementation, it appears the JavaScript bindings either:
   - Don't support this syntax
   - Have different parsing rules
   - Or our version (0.21.0) doesn't include this feature in the JS bindings

3. **Semantic Equivalence**: In the tree-sitter-javascript grammar:
   - `function_declaration` nodes are named functions (e.g., `function foo() {}`)
   - `function_expression` nodes are anonymous functions (e.g., `function() {}` or assigned like `const foo = function() {}`)
   
   Therefore, `(function_expression)` correctly captures all anonymous function cases that `(function !name)` was intended to match.

## Background: What `(function !name)` Means

The pattern `(function !name)` uses tree-sitter's negated field syntax:
- The `!` operator negates a field check
- `(function !name)` matches function nodes that **don't have** a `name` field
- This effectively matches anonymous functions

This is **not a bug** in bloop - it's valid tree-sitter query syntax that works in their Rust implementation.

## Impact

This change affects:
- `/apps/ts-tree-sitter/src/languages/javascript/scopes.scm` (line 9)
- `/apps/ts-tree-sitter/src/languages/typescript/scopes.scm` (line 14)

Both files now use `(function_expression)` instead of `(function !name)`.

## Verification

All JavaScript and TypeScript tests pass with this change, confirming that:
1. The scope extraction works correctly for anonymous functions
2. Named function declarations are still properly handled by the `(function_declaration)` query
3. The nested scope structures are correctly generated for all function types

## Conclusion

While the original bloop `.scm` files use a more sophisticated query syntax that may be specific to the Rust tree-sitter bindings, our TypeScript implementation achieves the same semantic results using the standard tree-sitter-javascript node types. This ensures compatibility with the JavaScript ecosystem while maintaining the same functionality.