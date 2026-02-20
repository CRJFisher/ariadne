# Folder Structure Rules

## Overview

This document defines the standard folder structure for modules that leverage tree-sitter queries.

## Standard Module Structure

Every module follows this exact structure:

```
module_name/
├── index.ts                    # Main export aggregating functionality
├── module_name.ts              # Core logic integrating queries
├── queries/                    # Tree-sitter query patterns
│   ├── javascript.scm         # JavaScript-specific queries
│   ├── typescript.scm         # TypeScript-specific queries
│   ├── python.scm             # Python-specific queries
│   └── rust.scm               # Rust-specific queries
├── module_name.test.ts        # Tests for main functionality
└── fixtures/                   # Test fixtures (if needed)
    ├── javascript/
    ├── typescript/
    ├── python/
    └── rust/
```

## File Responsibilities

### index.ts

- Aggregates and exports the module's public API
- Combines functionality from core logic
- Makes the module's interface clear

### module_name.ts

- Contains the core processing logic
- Loads and executes tree-sitter queries
- Coordinates query results processing
- Handles language-specific variations through query patterns

### queries/ Directory

- Contains `.scm` files with tree-sitter query patterns
- Each language has its own query file
- Query files define patterns for extracting information from ASTs
- Queries handle language-specific syntax variations

### Query File Structure (*.scm)

Query files use tree-sitter's S-expression query syntax:

```scheme
; javascript.scm example
; Function declarations
(function_declaration
  name: (identifier) @function.name
  parameters: (formal_parameters) @function.params
  body: (statement_block) @function.body)

; Method definitions
(method_definition
  name: (property_identifier) @method.name
  parameters: (formal_parameters) @method.params)
```

## Query Development Guidelines

### Query Patterns

- Keep queries focused on specific extraction tasks
- Use capture names that clearly indicate purpose (@function.name, @class.body)
- Comment complex patterns to explain their purpose
- Test queries against real code samples

### Language Coverage

- Start with common patterns shared across languages
- Add language-specific patterns as separate captures
- Document which patterns are language-specific

### Query Organization

```text
queries/
├── javascript.scm    # ES6+ patterns
├── typescript.scm    # Includes JS patterns + TS-specific
├── python.scm        # Python 3.x patterns
└── rust.scm          # Rust 2021 edition patterns
```

## Test File Organization

### Test Coverage Requirements

- Every module must have comprehensive tests
- Test files verify query accuracy across languages
- Fixtures provide real code samples for testing

### Test Structure

```text
module_name.test.ts
- Tests main API functionality
- Verifies query execution
- Validates cross-language behavior
- Uses fixtures for realistic test cases
```

## Language Support Detection

The presence of a query file indicates language support:

- If `queries/python.scm` exists → Python is supported
- If `queries/rust.scm` exists → Rust is supported
- Module gracefully handles missing query files

## Module Creation Checklist

When creating a new query-based module:

1. [ ] Create module directory structure
2. [ ] Write core logic in `module_name.ts`
3. [ ] Define query patterns in `queries/*.scm`
4. [ ] Create `index.ts` with exports
5. [ ] Write comprehensive tests
6. [ ] Add language-specific fixtures
7. [ ] Verify query patterns with real code
8. [ ] Test all supported languages

## Example: function_calls Module

```text
function_calls/
├── index.ts                         # Exports findFunctionCalls()
├── function_calls.ts                # Query execution and processing
├── queries/
│   ├── javascript.scm              # JS call patterns
│   ├── typescript.scm              # TS call patterns + generics
│   ├── python.scm                  # Python call patterns
│   └── rust.scm                    # Rust call patterns + macros
├── function_calls.test.ts          # Comprehensive tests
└── fixtures/
    ├── javascript/
    │   └── complex_calls.js
    ├── typescript/
    │   └── generic_calls.ts
    ├── python/
    │   └── decorated_calls.py
    └── rust/
        └── macro_calls.rs
```

## Query File Examples

### JavaScript Query Pattern

```scheme
; queries/javascript.scm
(call_expression
  function: [
    (identifier) @function.direct
    (member_expression
      property: (property_identifier) @function.method)
  ]
  arguments: (arguments) @function.args)
```

### Python Query Pattern

```scheme
; queries/python.scm
(call
  function: [
    (identifier) @function.direct
    (attribute
      attribute: (identifier) @function.method)
  ]
  arguments: (argument_list) @function.args)
```

## Benefits

- **Declarative**: Queries express what to find, not how
- **Maintainable**: Language differences isolated in query files
- **Performant**: Tree-sitter queries are highly optimized
- **Consistent**: Same module structure across all features
- **Extensible**: Easy to add new language support
