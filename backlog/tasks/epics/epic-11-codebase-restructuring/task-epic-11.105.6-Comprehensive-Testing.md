# Task 11.105.6: Comprehensive Testing

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2-3 hours
**Parent:** task-epic-11.105
**Dependencies:** 105.1, 105.2, 105.3, 105.4, 105.5

## Objective

Create comprehensive test coverage for all type extraction functionality across all 4 supported languages (JavaScript, TypeScript, Python, Rust). Ensure >90% line coverage and >85% branch coverage.

## Test Structure

```
packages/core/src/index_single_file/type_preprocessing/tests/
├── type_bindings.test.ts
├── constructor_tracking.test.ts
├── member_extraction.test.ts
├── alias_extraction.test.ts
├── integration.test.ts
├── fixtures/
│   ├── javascript/
│   │   ├── type-bindings.js
│   │   └── constructor-tracking.js
│   ├── typescript/
│   │   ├── type-bindings.ts
│   │   ├── constructor-tracking.ts
│   │   ├── member-extraction.ts
│   │   └── alias-extraction.ts
│   ├── python/
│   │   ├── type_bindings.py
│   │   ├── constructor_tracking.py
│   │   └── member_extraction.py
│   └── rust/
│       ├── type_bindings.rs
│       ├── constructor_tracking.rs
│       └── member_extraction.rs
```

## Test Categories

### 1. Type Bindings Tests (type_bindings.test.ts)

**Coverage:**
- Variable annotations
- Parameter annotations
- Optional parameters
- Union types (basic)
- All 4 languages

**Key Tests:**

```typescript
describe("extract_type_annotations", () => {
  describe("TypeScript", () => {
    test("variable with type annotation", () => { /* ... */ });
    test("parameter with type annotation", () => { /* ... */ });
    test("optional parameter", () => { /* ... */ });
    test("union type annotation", () => { /* ... */ });
    test("complex generic type", () => { /* ... */ });
  });

  describe("Python", () => {
    test("function parameter with type hint", () => { /* ... */ });
    test("variable with type annotation", () => { /* ... */ });
    test("method parameter with type hint", () => { /* ... */ });
  });

  describe("Rust", () => {
    test("variable with type annotation", () => { /* ... */ });
    test("function parameter with type", () => { /* ... */ });
    test("struct field with type", () => { /* ... */ });
  });

  describe("JavaScript", () => {
    test("JSDoc type annotations", () => {
      // May be deferred if complex
    });
  });
});
```

### 2. Constructor Tracking Tests (constructor_tracking.test.ts)

**Coverage:**
- Simple constructor assignments
- Property assignments
- Multiple constructors
- Language-specific patterns

**Key Tests:**

```typescript
describe("extract_constructor_bindings", () => {
  describe("TypeScript", () => {
    test("simple constructor", () => { /* ... */ });
    test("property assignment", () => { /* ... */ });
    test("multiple constructors", () => { /* ... */ });
    test("constructor in conditional", () => { /* ... */ });
  });

  describe("Python", () => {
    test("class instantiation", () => { /* ... */ });
    test("self property assignment", () => { /* ... */ });
  });

  describe("Rust", () => {
    test("Type::new() pattern", () => { /* ... */ });
    test("struct literal", () => { /* ... */ });
  });

  describe("JavaScript", () => {
    test("new expression", () => { /* ... */ });
    test("class constructor", () => { /* ... */ });
  });
});
```

### 3. Member Extraction Tests (member_extraction.test.ts)

**Coverage:**
- Class methods and properties
- Interface members
- Inheritance tracking
- Static vs instance members
- Constructors

**Key Tests:**

```typescript
describe("extract_type_members", () => {
  describe("Classes", () => {
    test("methods and properties", () => { /* ... */ });
    test("constructor tracking", () => { /* ... */ });
    test("static methods", () => { /* ... */ });
    test("inheritance", () => { /* ... */ });
    test("empty class", () => { /* ... */ });
  });

  describe("Interfaces", () => {
    test("method signatures", () => { /* ... */ });
    test("property signatures", () => { /* ... */ });
    test("extension", () => { /* ... */ });
  });

  describe("Rust Enums", () => {
    test("enum methods", () => { /* ... */ });
  });
});
```

### 4. Type Alias Tests (alias_extraction.test.ts)

**Coverage:**
- Simple aliases
- Class/interface aliases
- Complex type expressions
- NOT resolution (verify strings stored)

**Key Tests:**

```typescript
describe("extract_type_alias_metadata", () => {
  test("simple type alias", () => {
    // Verify stores string, not SymbolId
  });

  test("class alias", () => {
    // Verify stores class name string
  });

  test("imported type alias", () => {
    // Verify stores imported name (not resolved)
  });

  test("complex generic expression", () => {
    // Verify stores full expression string
  });

  test("alias without expression", () => {
    // Verify skipped
  });
});
```

### 5. Integration Tests (integration.test.ts)

**Coverage:**
- End-to-end semantic indexing
- All extraction functions combined
- Realistic code examples
- All languages

**Key Tests:**

```typescript
describe("Type preprocessing integration", () => {
  test("complete TypeScript file", () => {
    const code = `
      class User {
        name: string;
        constructor(name: string) {}
        getName(): string { return this.name; }
      }

      type MyUser = User;

      const user1: User = getUser();
      const user2 = new User("test");
      const user3: MyUser = getUser();
    `;

    const index = build_semantic_index(/* ... */);

    // Verify all type data extracted
    expect(index.type_bindings.size).toBeGreaterThan(0);
    expect(index.type_members.size).toBeGreaterThan(0);
    expect(index.type_alias_metadata.size).toBeGreaterThan(0);

    // Verify specific bindings
    // ...
  });

  test("complete Python file", () => { /* ... */ });
  test("complete Rust file", () => { /* ... */ });
  test("complete JavaScript file", () => { /* ... */ });
});
```

## Test Fixtures

### TypeScript Fixture (fixtures/typescript/complete.ts)

```typescript
// Comprehensive TypeScript example covering all features

class Animal {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  move(): void {
    console.log("moving");
  }
}

class Dog extends Animal {
  bark(): void {
    console.log("woof");
  }
}

interface IPet {
  play(): void;
}

type AnimalType = Animal;
type PetDog = Dog;

function processAnimal(animal: Animal): void {
  animal.move();
}

const dog: Dog = new Dog("Buddy");
const pet = new Dog("Max");
const animal: AnimalType = getDog();
```

### Python Fixture (fixtures/python/complete.py)

```python
# Comprehensive Python example

class Animal:
    def __init__(self, name: str):
        self.name = name

    def move(self) -> None:
        print("moving")

class Dog(Animal):
    def bark(self) -> None:
        print("woof")

def process_animal(animal: Animal) -> None:
    animal.move()

dog: Dog = Dog("Buddy")
pet = Dog("Max")
```

### Rust Fixture (fixtures/rust/complete.rs)

```rust
// Comprehensive Rust example

struct Animal {
    name: String
}

impl Animal {
    fn new(name: String) -> Animal {
        Animal { name }
    }

    fn move_animal(&self) {
        println!("moving");
    }
}

struct Dog {
    animal: Animal
}

impl Dog {
    fn bark(&self) {
        println!("woof");
    }
}

type AnimalType = Animal;

fn process_animal(animal: Animal) {
    animal.move_animal();
}

let dog: Dog = Dog { animal: Animal::new(String::from("Buddy")) };
let pet = Dog::new();
```

## Coverage Goals

### Line Coverage: >90%

All extraction functions must have >90% line coverage:
- `extract_type_annotations()`
- `extract_constructor_bindings()`
- `extract_type_members()`
- `extract_type_alias_metadata()`
- Integration helpers

### Branch Coverage: >85%

All conditional branches tested:
- Optional field handling
- Empty collections
- Language-specific patterns
- Edge cases

### Function Coverage: 100%

Every exported function has at least one test.

## Running Tests

```bash
# All type preprocessing tests
npm test -- type_preprocessing

# Specific test file
npm test -- type_bindings

# With coverage
npm run test:coverage -- type_preprocessing

# Watch mode
npm test -- type_preprocessing --watch
```

## Success Criteria

### Functional
- ✅ All test categories implemented
- ✅ All 4 languages tested
- ✅ Fixtures created for realistic examples
- ✅ All tests pass

### Coverage
- ✅ >90% line coverage
- ✅ >85% branch coverage
- ✅ 100% function coverage
- ✅ Coverage report generated

### Code Quality
- ✅ Tests are clear and well-documented
- ✅ Test names describe what's being tested
- ✅ Fixtures are realistic and reusable
- ✅ No flaky tests

## Dependencies

**Requires:**
- Tasks 105.1-105.5 completed
- Vitest testing framework
- build_semantic_index() function

**No external dependencies**

## Next Steps

After completion:
- Task 11.109 can confidently use this extracted data
- Type preprocessing is fully validated
- Ready for production use

## Technical Notes

### Test Data Setup

Use helper functions to build test data:

```typescript
function build_test_index(code: string, language: Language): SemanticIndex {
  const file = parse_file(`test.${ext}`, code);
  return build_semantic_index(file, file.tree, language);
}

function find_symbol_by_name(
  index: SemanticIndex,
  name: string
): SymbolId | null {
  const symbols = index.symbols_by_name.get(name as SymbolName);
  return symbols?.[0] || null;
}
```

### Assertion Helpers

```typescript
function assert_has_binding(
  index: SemanticIndex,
  var_name: string,
  type_name: string
) {
  const var_symbol = find_symbol_by_name(index, var_name);
  expect(var_symbol).toBeDefined();

  const var_def = index.variables.get(var_symbol);
  const binding = index.type_bindings.get(location_key(var_def.location));

  expect(binding).toBe(type_name);
}
```

### Performance Testing

Add basic performance benchmarks:

```typescript
test("performance: large file with many types", () => {
  // Generate code with 1000 classes
  const code = generate_large_file(1000);

  const start = performance.now();
  const index = build_semantic_index(/* ... */);
  const duration = performance.now() - start;

  // Should complete in reasonable time
  expect(duration).toBeLessThan(1000); // 1 second
});
```
