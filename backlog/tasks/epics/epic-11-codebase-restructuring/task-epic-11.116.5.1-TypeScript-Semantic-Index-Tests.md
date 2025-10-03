# Task epic-11.116.5.1: Refactor TypeScript semantic_index Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** 116.5.0
**Language:** TypeScript
**Priority:** High
**Estimated Effort:** 2 hours

## Objective

Refactor `semantic_index.typescript.test.ts` to use the new JSON fixture approach instead of inline test code.

## Current Test File

**Location:** `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

## Refactoring Strategy

### Before (Inline Code):
```typescript
it("should capture interfaces, classes, and methods", () => {
  const code = `
    interface User {
      id: number;
      name: string;
    }
    class UserImpl implements User {
      constructor(public id: number, public name: string) {}
      getName(): string {
        return this.name;
      }
    }
  `;

  const tree = parser.parse(code);
  const parsedFile = createParsedFile(code, "test.ts", tree, "typescript");
  const index = build_semantic_index(parsedFile, tree, "typescript");

  expect(index.interfaces.size).toBeGreaterThanOrEqual(1);
  const interfaceNames = Array.from(index.interfaces.values()).map(i => i.name);
  expect(interfaceNames).toContain("User");
  // ... more assertions
});
```

### After (Fixture-Based):
```typescript
it("should capture interfaces, classes, and methods", () => {
  const { parsed } = load_code_fixture("typescript/code/classes/class_implements_interface.ts");
  const actual = build_semantic_index(parsed, parsed.tree, "typescript");
  const expected = load_semantic_index_fixture(
    "typescript/semantic_index/classes/class_implements_interface.semantic_index.json"
  );

  expect(compare_semantic_index(actual, expected)).toEqual({ matches: true });
});
```

## Tasks

### 1. Review Existing Tests

Map existing inline tests to fixture files:
- Identify what each test covers
- Find corresponding fixture from 116.3.1
- Note any tests that don't have fixtures yet

### 2. Organize by Category

Restructure tests by language feature category:

```typescript
describe("Semantic Index - TypeScript", () => {
  describe("Classes", () => {
    it("should index basic class definition", () => { /* ... */ });
    it("should index class inheritance", () => { /* ... */ });
    it("should index class with static members", () => { /* ... */ });
    it("should index abstract classes", () => { /* ... */ });
  });

  describe("Interfaces", () => {
    it("should index basic interface", () => { /* ... */ });
    it("should index interface extension", () => { /* ... */ });
    it("should index interface implementation", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("should index function declarations", () => { /* ... */ });
    it("should index arrow functions", () => { /* ... */ });
    it("should index function overloads", () => { /* ... */ });
  });

  describe("Types", () => {
    it("should index type aliases", () => { /* ... */ });
    it("should index union types", () => { /* ... */ });
    it("should index intersection types", () => { /* ... */ });
    it("should index conditional types", () => { /* ... */ });
  });

  describe("Generics", () => {
    it("should index generic functions", () => { /* ... */ });
    it("should index generic classes", () => { /* ... */ });
    it("should index generic constraints", () => { /* ... */ });
  });

  describe("Modules", () => {
    it("should index named exports", () => { /* ... */ });
    it("should index default exports", () => { /* ... */ });
    it("should index re-exports", () => { /* ... */ });
  });

  describe("Enums", () => {
    it("should index numeric enums", () => { /* ... */ });
    it("should index string enums", () => { /* ... */ });
  });

  describe("Decorators", () => {
    it("should index class decorators", () => { /* ... */ });
    it("should index method decorators", () => { /* ... */ });
  });
});
```

### 3. Refactor Test Implementation

For each test:

1. **Identify fixture**: Find corresponding code fixture
2. **Replace inline code**: Use `load_code_fixture()`
3. **Load expected output**: Use `load_semantic_index_fixture()`
4. **Compare**: Use `compare_semantic_index()`

**Standard pattern:**
```typescript
it("should index {feature}", () => {
  const { parsed } = load_code_fixture("typescript/code/{category}/{fixture}.ts");
  const actual = build_semantic_index(parsed, parsed.tree, "typescript");
  const expected = load_semantic_index_fixture(
    "typescript/semantic_index/{category}/{fixture}.semantic_index.json"
  );
  expect(compare_semantic_index(actual, expected)).toEqual({ matches: true });
});
```

### 4. Handle Missing Fixtures

For tests without fixtures:
- **Option A**: Keep as inline test temporarily
- **Option B**: Create missing fixture in 116.3
- **Option C**: Mark as `.skip()` with TODO comment

### 5. Verify Tests Pass

After refactoring:
1. Run test suite: `npm test -- semantic_index.typescript`
2. Verify all tests pass
3. Check test coverage is maintained
4. Ensure no regressions

## Test Coverage Goals

Ensure TypeScript-specific features are covered:

### Classes
- [ ] Basic class definition
- [ ] Class inheritance (extends)
- [ ] Abstract classes
- [ ] Static members
- [ ] Access modifiers (public/private/protected)
- [ ] Constructor parameter properties

### Interfaces
- [ ] Basic interface definition
- [ ] Interface extension (extends)
- [ ] Class implementing interface

### Types
- [ ] Type aliases
- [ ] Union types
- [ ] Intersection types
- [ ] Conditional types
- [ ] Mapped types

### Generics
- [ ] Generic functions
- [ ] Generic classes
- [ ] Generic constraints
- [ ] Type parameter inference

### Modules
- [ ] Named imports/exports
- [ ] Default imports/exports
- [ ] Type-only imports
- [ ] Re-exports

### Functions
- [ ] Function declarations
- [ ] Arrow functions
- [ ] Function overloads
- [ ] Async functions

### Enums
- [ ] Numeric enums
- [ ] String enums

### Decorators
- [ ] Class decorators
- [ ] Method decorators
- [ ] Property decorators

## Migration Checklist

- [ ] Test file backed up (if needed)
- [ ] Import test helpers at top of file
- [ ] All inline code removed
- [ ] Tests organized by category
- [ ] All fixtures referenced correctly
- [ ] All tests passing
- [ ] No test coverage regression
- [ ] Test descriptions are clear

## Deliverables

- [ ] `semantic_index.typescript.test.ts` refactored
- [ ] All tests use fixtures (no inline code)
- [ ] Tests organized by feature category
- [ ] All tests passing
- [ ] Test coverage maintained or improved

## Acceptance Criteria

- [ ] Zero inline test code (all using fixtures)
- [ ] Tests organized logically by category
- [ ] All existing test cases preserved
- [ ] Test suite passes: `npm test -- semantic_index.typescript`
- [ ] Comparison errors provide useful debugging info

## Notes

- Keep test descriptions clear and specific
- Group related tests together
- Consider using `describe.each()` for similar patterns
- Document any fixture assumptions in test comments
