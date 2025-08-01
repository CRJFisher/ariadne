# Ariadne Language Feature Matrix

This document tracks which language features are supported by Ariadne for each programming language.

## Core Library Functionality

| Feature                   | TypeScript | JavaScript | Python | Rust | Notes                            |
| ------------------------- | ---------- | ---------- | ------ | ---- | -------------------------------- |
| **Variable Declarations** | ✅         | ✅         | ✅     | ✅    | Different syntax per language    |
| **Function Definitions**  | ✅         | ✅         | ✅     | ✅    | Including nested functions       |
| **Class Definitions**     | ✅         | ✅         | ✅     | ✅    | Rust uses struct/impl            |
| **Method Definitions**    | ✅         | ✅         | ✅     | ✅    | Instance and static methods      |
| **Import Statements**     | ✅         | ✅         | ✅     | ✅    | ES6/CommonJS/Python/Rust imports |
| **Parameter Definitions** | ✅         | ✅         | ✅     | ✅    | Including default parameters     |
| **Local Scopes**          | ✅         | ✅         | ✅     | ✅    | Block and function scopes        |
| **Reference Resolution**  | ✅         | ✅         | ✅     | ✅    | Finding symbol usage             |
| **Go-to-Definition**      | ✅         | ✅         | ✅     | ✅    | Navigate to symbol definition    |
| **Function Metadata**     | ✅         | ✅         | ✅     | ✅    | Async, test, private, params     |

## Advanced Language-Specific Feature Support

| Feature                      | TypeScript | JavaScript | Python | Rust | Notes                       |
| ---------------------------- | ---------- | ---------- | ------ | ---- | --------------------------- |
| **Type Annotations**         | ✅         | ❌         | ✅     | ✅   | Type hints/annotations      |
| **Generics/Type Parameters** | ✅         | ❌         | ✅     | ✅   | `<T>` syntax varies         |
| **Decorators**               | ✅         | ✅         | ✅     | ❌   | `@decorator` syntax         |
| **Pattern Matching**         | ✅         | ✅         | ✅     | ✅   | Destructuring varies        |
| **Arrow Functions**          | ✅         | ✅         | ✅     | ✅   | Lambda/closure syntax       |
| **Generator Functions**      | ✅         | ✅         | ✅     | ❌   | `function*` / `yield`       |
| **Async/Await**              | ✅         | ✅         | ✅     | ✅   | Async function support      |
| **Private Members**          | ✅         | ✅         | ✅     | ✅   | `#field` / `_field` / `pub` |

## Language-Specific Features

### TypeScript

- Type annotations and type aliases
- Generics/Type parameters (`<T>`)
- Interfaces and type unions
- Optional parameters (`param?: Type`)
- JSX/TSX elements
- Decorators (experimental)
- Private fields with `#`

### JavaScript

- Hoisting (var and function)
- Object/array destructuring with rest
- Spread operator (`...args`)
- Template literals
- `this` binding (regular vs arrow functions)
- Generator functions (`function*`)
- CommonJS (`require`/`module.exports`)
- ES6 modules (`import`/`export`)

### Python

- List/dict/set comprehensions
- Walrus operator (`:=`)
- `global` and `nonlocal` keywords
- `with` statements
- Multiple inheritance
- Decorators (`@decorator`)
- Docstrings
- Type hints (PEP 484)
- Async/await and async generators

### Rust

- Lifetime parameters (`'a`)
- Ownership (`&` and `&mut`)
- Pattern matching in `match`
- Trait definitions and implementations
- Associated types and constants
- Module system (`mod`, `use`, `pub`)
- Loop labels (`'label:`)
- Generic type parameters
- Macro invocations (`!`)

## Testing Requirements

Each language implementation should be tested for:

### Core Test Categories

1. **Definition Tests**: Can we find all definitions of the expected type?

   - Variables, constants, functions, classes/structs
   - Parameters, imports, type definitions
   - Nested definitions (methods, inner functions)

2. **Reference Tests**: Can we find all references to a definition?

   - Variable usage in expressions
   - Function/method calls
   - Type references in annotations
   - Import usage

3. **Scope Tests**: Are definitions visible in the correct scopes?

   - Block scope vs function scope
   - Module/namespace scope
   - Class/object scope
   - Closure captures

4. **Navigation Tests**: Does go-to-definition work correctly?

   - From reference to definition
   - Across file boundaries (imports)
   - Through type annotations

5. **Edge Case Tests**: Handle syntax errors, incomplete code, etc.
   - Syntax errors don't crash the parser
   - Incomplete code (missing closing braces)
   - Unicode identifiers
   - Reserved keywords as identifiers

## Adding New Language Support

When adding a new language, ensure:

1. All core features are implemented and tested
2. Language-specific features are documented here
3. Test cases follow the shared test patterns
4. Feature gaps are clearly documented

## Function Metadata

Ariadne extracts rich metadata for function definitions across all supported languages:

### Metadata Fields

| Field               | Description                                              | TypeScript | JavaScript | Python | Rust |
| ------------------- | -------------------------------------------------------- | ---------- | ---------- | ------ | ---- |
| `is_async`          | Function is declared with async keyword                  | ✅         | ✅         | ✅     | ✅   |
| `is_test`           | Function is a test (by name or decorator/attribute)      | ✅         | ✅         | ✅     | ✅   |
| `is_private`        | Function has private visibility                          | ✅         | ✅         | ✅     | ✅   |
| `line_count`        | Number of lines in function body                         | ✅         | ✅         | ✅     | ✅   |
| `parameter_names`   | List of parameter names (preserves order)                | ✅         | ✅         | ✅     | ✅   |
| `has_decorator`     | Function has decorators (language-specific)              | ❌         | ❌         | ✅     | ❌   |
| `class_name`        | For methods, the containing class/struct name            | ✅         | ✅         | ✅     | ✅   |
| `complexity`        | Cyclomatic complexity (future enhancement)               | ❌         | ❌         | ❌     | ❌   |

### Test Detection

Functions are identified as tests using language-specific patterns:

- **TypeScript/JavaScript**: Functions with names like `test*`, `*Test`, inside `describe()`, `it()`, `test()` blocks
- **Python**: Functions named `test_*`, `setUp`, `tearDown`, or decorated with `@pytest.*`, `@unittest.*`
- **Rust**: Functions with `#[test]` or `#[cfg(test)]` attributes

### Private Detection

- **TypeScript**: `private` keyword or `#` prefix for private fields/methods
- **JavaScript**: `#` prefix for private fields/methods
- **Python**: Names starting with `_` (single underscore)
- **Rust**: Functions without `pub` visibility modifier
