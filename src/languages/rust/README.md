# Rust Language Support

This module provides Rust language support for the AST-Climber code intelligence system.

## Features

- **Scope Resolution**: Tracks lexical scopes including blocks, functions, modules, impl blocks, traits, and more
- **Symbol Types**: Supports all major Rust symbols:
  - Variables and constants (`let`, `const`, `static`)
  - Functions and methods
  - Types (structs, enums, unions, type aliases)
  - Traits and implementations
  - Modules
  - Lifetimes
  - Labels
- **Pattern Matching**: Handles Rust's complex pattern matching in let bindings, function parameters, and match arms
- **References**: Tracks symbol usage across expressions, type annotations, and paths

## Implementation Details

The implementation uses tree-sitter-rust for parsing and a comprehensive scopes.scm query file adapted from the Bloop project to handle Rust's scope resolution rules.

### Key Rust-specific Features

1. **Lifetime Tracking**: Properly scopes lifetime parameters in impl blocks, functions, and references
2. **Pattern Destructuring**: Handles tuple patterns, struct patterns, and complex nested patterns
3. **Module System**: Tracks module definitions and use statements with aliasing support
4. **Self Parameter**: Special handling for `self` in method definitions
5. **Loop Labels**: Supports labeled loops and break/continue with labels

## Configuration

The Rust language configuration includes:
- File extensions: `.rs`
- Parser timeout: 5 seconds (configurable)
- Comprehensive namespace hierarchy for symbol resolution

## Testing

The test suite covers all major Rust language constructs with examples adapted from the Bloop project's test cases.