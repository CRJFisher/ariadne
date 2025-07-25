# AST-Climber Testing Guide

This guide explains how to write and maintain tests for AST-Climber's multi-language support.

## Overview

AST-Climber uses a shared testing infrastructure to ensure consistent test coverage across all supported languages. This approach:

- Reduces code duplication
- Ensures feature parity across languages
- Makes it easy to add new language support
- Provides clear documentation of supported features

## Test Structure

### 1. Shared Language Tests (`src/test/shared-language-tests.ts`)

This module provides the core testing infrastructure:

- **`SHARED_TEST_FIXTURES`**: Common test cases that should work across all languages
- **`generateLanguageTests()`**: Generates parameterized tests for a specific language
- **`runLanguageSpecificTests()`**: Runs language-specific feature tests

### 2. Language Feature Matrix (`docs/language-feature-matrix.md`)

Documents which features are supported by each language, helping identify:

- What needs to be tested
- Feature gaps
- Language-specific capabilities

### 3. Language-Specific Test Files

Each language has its own test file that:

- Uses `generateLanguageTests()` for common features
- Implements language-specific tests with `runLanguageSpecificTests()`

## Writing Tests for a New Language

### Step 1: Create the Test File

Create `src/test/<language>-shared.test.ts`:

```typescript
import {
  generateLanguageTests,
  runLanguageSpecificTests,
} from "./shared-language-tests";

// Generate common tests
generateLanguageTests("yourlang", () => "ext");

// Add language-specific tests
const yourLangSpecificTests = [
  {
    name: "Special Feature",
    code: `// Your language code here`,
    test: (project, fileName) => {
      // Test implementation
    },
  },
];

runLanguageSpecificTests("YourLang", yourLangSpecificTests, () => "ext");
```

### Step 2: Update Shared Fixtures

If your language has different syntax for common features, add it to `SHARED_TEST_FIXTURES`:

```typescript
{
  name: 'Variable Declaration',
  languages: {
    yourlang: {
      name: 'variable binding',
      code: `let x = 42;`  // Your language syntax
    }
  },
  expectations: {
    definitions: [
      { name: 'x', kind: 'variable' }
    ]
  }
}
```

### Step 3: Document Language Features

Update `docs/language-feature-matrix.md` to include your language's capabilities.

## Test Categories

### Core Features (All Languages Must Support)

1. **Variable/Constant Declarations**

   - Local variables
   - Constants
   - Global variables

2. **Function Definitions**

   - Regular functions
   - Nested functions
   - Anonymous functions/lambdas

3. **Class/Type Definitions**

   - Class declarations
   - Method definitions
   - Constructor/initialization

4. **Import/Module System**

   - Import statements
   - Export declarations
   - Module references

5. **Scope Resolution**
   - Block scopes
   - Function scopes
   - Nested scopes

### Language-Specific Features

Document and test features unique to your language:

- **TypeScript**: Generics, type annotations, interfaces
- **Python**: Decorators, comprehensions, walrus operator
- **Rust**: Lifetimes, ownership, pattern matching
- **JavaScript**: Hoisting, destructuring, spread operator

## Best Practices

### 1. Use Descriptive Test Names

```typescript
test("should resolve method calls in nested classes", () => {
  // Good: Clearly describes what's being tested
});
```

### 2. Test Edge Cases

- Empty files
- Syntax errors
- Incomplete code
- Unicode identifiers
- Reserved keywords

### 3. Keep Tests Focused

Each test should verify one specific behavior:

```typescript
// Good: Tests one thing
test("finds function parameters", () => {
  const code = `function f(a, b) {}`;
  // Test only parameter detection
});

// Bad: Tests too many things
test("function features", () => {
  // Tests parameters, return types, body, etc.
});
```

### 4. Use Real-World Code Examples

Test fixtures should resemble actual code developers write:

```typescript
// Good: Realistic code
const code = `
class UserService {
  async getUser(id: string) {
    return await db.users.findById(id);
  }
}`;

// Bad: Contrived example
const code = `function f(){var x=1;return x;}`;
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests for a specific language
npm test typescript-shared.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Debugging Test Failures

1. **Check the language's scope query** (`src/languages/<lang>/scopes.scm`)
2. **Verify the parser is working** - Use tree-sitter playground
3. **Add debug logging** to `build_scope_graph()`
4. **Examine the generated AST** using `tree.rootNode.toString()`

## Adding New Test Categories

When adding support for a new language feature across all languages:

1. Add a new fixture to `SHARED_TEST_FIXTURES`
2. Implement the feature in each language's scope query
3. Update the language feature matrix
4. Run tests to ensure all languages pass

## Maintenance

- Review test coverage regularly
- Update tests when adding new features
- Keep language feature matrix up-to-date
- Remove or update obsolete tests
- Ensure CI runs all language tests
