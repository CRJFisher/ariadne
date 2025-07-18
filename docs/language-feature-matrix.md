# RefScope Language Feature Matrix

This document tracks which language features are supported by RefScope for each programming language.

## Core Features (All Languages)

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

## Advanced Features

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
