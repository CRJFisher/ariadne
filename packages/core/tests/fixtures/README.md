# Test Fixtures

This directory contains code fixtures and their corresponding semantic index JSON files used for testing the Ariadne semantic indexing system.

## Directory Structure

```
fixtures/
├── typescript/
│   ├── code/              # Source TypeScript files
│   └── semantic_index/    # Generated JSON fixtures
├── python/
│   ├── code/              # Source Python files
│   └── semantic_index/    # Generated JSON fixtures
├── rust/
│   ├── code/              # Source Rust files
│   └── semantic_index/    # Generated JSON fixtures
└── javascript/
    ├── code/              # Source JavaScript files
    └── semantic_index/    # Generated JSON fixtures
```

## Organization Principles

### Code Fixtures (`code/` directories)

Code fixtures are organized by **language feature** into category directories:

- **classes/** - Class definitions, inheritance, methods
- **functions/** - Function declarations, expressions, patterns
- **interfaces/** - Interface definitions (TypeScript)
- **types/** - Type aliases, unions, intersections (TypeScript)
- **generics/** - Generic types and functions (TypeScript)
- **modules/** - Import/export patterns
- **enums/** - Enum definitions
- **structs/** - Struct definitions (Rust)
- **traits/** - Trait definitions (Rust)

### Semantic Index Fixtures (`semantic_index/` directories)

JSON files in `semantic_index/` directories mirror the structure of `code/` directories. Each JSON file contains the semantic index generated from the corresponding source file.

**Naming convention:**
- Source: `code/classes/basic_class.ts`
- JSON: `semantic_index/classes/basic_class.json`

## TypeScript Fixtures

### Classes (8 fixtures)

- **basic_class.ts** - Simple class with constructor *(created in task 116.2)*
- **properties.ts** - Access modifiers (public, private, protected, readonly)
- **inheritance.ts** - Abstract classes, extends, method overriding
- **methods.ts** - Instance methods, static methods, static properties

### Functions (4 fixtures)

- **basic_functions.ts** - Function declarations with various signatures
- **arrow_functions.ts** - Arrow functions, implicit returns, closures
- **call_chains.ts** - Function calling other functions (tests call graph)
- **async_functions.ts** - Async/await patterns, Promise handling
- **recursive.ts** - Recursive functions, mutual recursion

### Interfaces (2 fixtures)

- **basic_interface.ts** - Interface declarations, optional properties, method signatures
- **extends.ts** - Interface inheritance, multiple inheritance

### Types (2 fixtures)

- **type_aliases.ts** - Type aliases, object types, function types, tuples
- **unions.ts** - Union types, discriminated unions, type guards

### Generics (2 fixtures)

- **generic_functions.ts** - Generic function parameters, constraints
- **generic_classes.ts** - Generic class definitions, type constraints

### Modules (2 fixtures)

- **exports.ts** - Named exports, default exports, export lists
- **imports.ts** - Named imports, default imports, namespace imports

### Enums (2 fixtures)

- **basic_enum.ts** - Numeric enums, computed members
- **string_enum.ts** - String enums, const enums

## Python Fixtures

### Classes (2 fixtures)

- **basic_class.py** - Class with `__init__`, instance methods
- **inheritance.py** - Class inheritance, `super()`, method overriding

### Functions (1 fixture)

- **basic_functions.py** - Function declarations, call chains

### Modules (1 fixture)

- **imports.py** - Import statements, from imports, typing

## Rust Fixtures

### Functions (1 fixture)

- **basic_functions.rs** - Function declarations, call chains

### Structs (1 fixture)

- **basic_struct.rs** - Struct definitions, impl blocks, methods

## JavaScript Fixtures

### Classes (1 fixture)

- **basic_class.js** - ES6 classes, constructors, inheritance

### Functions (1 fixture)

- **basic_functions.js** - Function declarations, arrow functions, CommonJS exports

## Fixture Characteristics

Good fixtures have these properties:

1. **Focused** - Each fixture tests specific language features
2. **Realistic** - Code patterns represent real-world usage
3. **Self-contained** - No external dependencies
4. **Appropriately sized** - 30-100 lines (not too minimal, not comprehensive)
5. **Well-documented** - Header comments explain what's being tested

## Generating JSON Fixtures

JSON fixtures are generated from code fixtures using:

```bash
# Generate all fixtures
npm run generate-fixtures:all

# Generate for specific language
npm run generate-fixtures:ts
npm run generate-fixtures:py
npm run generate-fixtures:rs
npm run generate-fixtures:js

# Generate single file
npm run generate-fixtures -- --file tests/fixtures/typescript/code/classes/basic_class.ts
```

See [generate_fixtures.ts](../../scripts/generate_fixtures.ts) for implementation details.

## Using Fixtures in Tests

### Loading Fixtures

```typescript
import { load_fixture, load_fixtures } from "./fixtures/fixture_helpers";

// Load single fixture
const index = load_fixture("typescript/semantic_index/classes/basic_class.json");

// Load multiple fixtures
const [index1, index2] = load_fixtures(
  "typescript/semantic_index/classes/properties.json",
  "typescript/semantic_index/functions/call_chains.json"
);
```

### Common Test Patterns

```typescript
describe("Feature tests", () => {
  it("should detect class definitions", () => {
    const index = load_fixture("typescript/semantic_index/classes/basic_class.json");

    expect(index.classes.size).toBeGreaterThan(0);
    const classNames = Array.from(index.classes.values()).map(c => c.name);
    expect(classNames).toContain("User");
  });
});
```

## Extending Fixtures

When adding new fixtures:

1. **Choose appropriate category** - Place file in correct language/category directory
2. **Follow naming conventions** - Use descriptive, lowercase names with underscores
3. **Add documentation** - Include header comment explaining what's tested
4. **Keep focused** - One fixture per feature or pattern
5. **Generate JSON** - Run fixture generation script
6. **Update this README** - Document new fixtures in relevant section

## Legacy Fixtures

The following files exist at language root level (not in `code/` directories):

### TypeScript
- `classes.ts`, `generics.ts`, `interfaces.ts`, `modules.ts`, `types.ts` - Original smaller fixtures
- `comprehensive_*.ts` - Large comprehensive test files (100-500 lines)
- `other-module.ts`, `specific-module.ts` - Module test helpers

### Python
- `classes.py`, `functions.py`, `imports.py`, etc. - Original fixtures
- `comprehensive_*.py` - Large comprehensive test files

### Rust
- Various `*.rs` files - Original comprehensive fixtures

These legacy files are kept for backward compatibility with existing tests but are being phased out in favor of the organized `code/` structure.

## Related Documentation

- [Task 116.1](../../../../backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.116.1-Design-Semantic-Index-JSON-Schema.md) - JSON schema design
- [Task 116.2](../../../../backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.116.2-Implement-Fixture-Generation-Tooling.md) - Fixture generation tooling
- [Task 116.3](../../../../backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.116.3-Organize-Code-Fixtures.md) - This task (fixture organization)
