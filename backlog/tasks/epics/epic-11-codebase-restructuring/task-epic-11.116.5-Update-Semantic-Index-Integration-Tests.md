# Task epic-11.116.5: Update semantic_index Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.4
**Priority:** Medium
**Created:** 2025-10-03

## Overview

Refactor the existing `semantic_index.<language>.test.ts` files to use the new JSON fixture approach. Instead of inline test code, tests will load code fixtures, run semantic indexing, and compare against JSON fixtures.

## Objectives

1. Refactor TypeScript semantic_index tests
2. Refactor Python semantic_index tests
3. Refactor Rust semantic_index tests
4. Refactor JavaScript semantic_index tests
5. Ensure all tests pass with new fixture approach

## Common Test Pattern

All language test files will follow this pattern:

```typescript
import { describe, it, expect } from "vitest";
import { build_semantic_index } from "./semantic_index";
import {
  load_code_fixture,
  load_semantic_index_fixture,
  compare_semantic_index
} from "../tests/fixtures/test_helpers";

describe("Semantic Index - TypeScript", () => {
  describe("Classes", () => {
    it("should index basic class definition", () => {
      // Load code fixture
      const { code, parsed } = load_code_fixture("typescript/code/classes/basic_class.ts");

      // Run semantic indexing
      const actual = build_semantic_index(parsed, parsed.tree, "typescript");

      // Load expected output
      const expected = load_semantic_index_fixture("typescript/semantic_index/classes/basic_class.semantic_index.json");

      // Compare
      expect(compare_semantic_index(actual, expected)).toEqual({ matches: true });
    });

    it("should index class inheritance", () => {
      const { code, parsed } = load_code_fixture("typescript/code/classes/inheritance.ts");
      const actual = build_semantic_index(parsed, parsed.tree, "typescript");
      const expected = load_semantic_index_fixture("typescript/semantic_index/classes/inheritance.semantic_index.json");
      expect(compare_semantic_index(actual, expected)).toEqual({ matches: true });
    });
  });

  describe("Functions", () => {
    // Similar tests for functions/...
  });
});
```

## Test Helper Functions

Create reusable helpers in `packages/core/tests/fixtures/test_helpers.ts`:

```typescript
/**
 * Load and parse a code fixture
 */
export function load_code_fixture(path: string): {
  code: string;
  parsed: ParsedFile;
  language: Language;
}

/**
 * Load a semantic_index JSON fixture
 */
export function load_semantic_index_fixture(path: string): SemanticIndexFixture

/**
 * Compare actual semantic index against expected fixture
 * Returns { matches: true } or { matches: false, diffs: [...] }
 */
export function compare_semantic_index(
  actual: SemanticIndex,
  expected: SemanticIndexFixture
): ComparisonResult

/**
 * Serialize semantic index to fixture format
 * (useful for debugging - shows what actual output looks like)
 */
export function serialize_semantic_index(index: SemanticIndex): SemanticIndexFixture
```

## Sub-tasks

### 116.5.1: Refactor TypeScript semantic_index Tests

**Current file**: `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

**Actions:**
1. Review existing tests to understand coverage
2. Map existing inline tests to new fixtures:
   - If fixture exists: Replace with new pattern
   - If fixture missing: Keep as-is or create fixture
3. Organize tests by category (classes, functions, interfaces, etc.)
4. Replace inline code with `load_code_fixture()` calls
5. Replace inline assertions with `load_semantic_index_fixture()` and `compare_semantic_index()`
6. Run tests and verify all pass

**Expected structure:**
```typescript
describe("Semantic Index - TypeScript", () => {
  describe("Classes", () => {
    it("basic class definition", () => { /* ... */ });
    it("class inheritance", () => { /* ... */ });
    it("class with static members", () => { /* ... */ });
  });

  describe("Interfaces", () => {
    it("basic interface", () => { /* ... */ });
    it("interface extension", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("function declaration", () => { /* ... */ });
    it("arrow function", () => { /* ... */ });
  });

  // ... more categories
});
```

**Deliverables:**
- [ ] All TypeScript tests refactored to use fixtures
- [ ] Tests organized by category
- [ ] All tests passing
- [ ] No inline code (all using fixtures)

### 116.5.2: Refactor Python semantic_index Tests

**Current file**: `packages/core/src/index_single_file/semantic_index.python.test.ts`

**Actions:**
- Same approach as 116.5.1 but for Python
- Categories: classes, functions, decorators, types, modules, etc.

**Deliverables:**
- [ ] All Python tests refactored
- [ ] All tests passing

### 116.5.3: Refactor Rust semantic_index Tests

**Current file**: `packages/core/src/index_single_file/semantic_index.rust.test.ts`

**Actions:**
- Same approach but for Rust
- Categories: structs, enums, traits, functions, modules, impl blocks

**Deliverables:**
- [ ] All Rust tests refactored
- [ ] All tests passing

### 116.5.4: Refactor JavaScript semantic_index Tests

**Current file**: `packages/core/src/index_single_file/semantic_index.javascript.test.ts`

**Actions:**
- Same approach but for JavaScript
- Categories: classes, functions, modules, objects

**Deliverables:**
- [ ] All JavaScript tests refactored
- [ ] All tests passing

## Comparison Strategy

The `compare_semantic_index` function should:

1. **Normalize before comparing**:
   - Sort collections by stable keys (IDs, locations)
   - Normalize whitespace in strings
   - Handle optional fields

2. **Provide detailed diffs** on mismatch:
   ```typescript
   {
     matches: false,
     diffs: [
       {
         path: "functions.symbol:test.ts:function:foo:1:0.name",
         expected: "foo",
         actual: "bar"
       },
       {
         path: "references[2]",
         expected: { name: "console", ... },
         actual: undefined
       }
     ]
   }
   ```

3. **Allow flexible matching** where appropriate:
   - Location offsets may vary slightly based on parsing
   - Some fields may be optional
   - Order may not matter for some collections

## Handling Test Failures

When tests fail:

1. **Check if fixture is wrong**:
   - Was fixture generated from old/buggy code?
   - Regenerate: `npx tsx scripts/generate_semantic_index_fixtures.ts --language typescript`

2. **Check if implementation changed**:
   - Is this an intentional improvement?
   - Regenerate fixtures to match new behavior

3. **Check if test is wrong**:
   - Is comparison too strict?
   - Update comparison logic

**Never manually edit fixtures to make tests pass** - always fix the source (code or implementation).

## Migration Strategy

Can be done incrementally:

1. **Phase 1**: Add fixture-based tests alongside existing inline tests
2. **Phase 2**: Verify both approaches pass
3. **Phase 3**: Remove inline tests, keep only fixture-based

Or all at once if confident.

## Acceptance Criteria

- [ ] All four language test files refactored (116.5.1 - 116.5.4)
- [ ] Test helpers implemented and working
- [ ] All tests passing
- [ ] Tests organized by feature category
- [ ] No inline test code (all using fixtures)
- [ ] Comparison logic provides useful error messages
- [ ] Test coverage equivalent or better than before

## Estimated Effort

- **Test helpers implementation**: 2 hours
- **TypeScript test refactor**: 2 hours
- **Python test refactor**: 1.5 hours
- **Rust test refactor**: 1.5 hours
- **JavaScript test refactor**: 1 hour
- **Debugging and fixes**: 2 hours
- **Total**: ~10 hours

## Benefits

After completion:
- ✓ Tests are easier to read and maintain
- ✓ Adding new test cases is trivial (just add a fixture)
- ✓ Test coverage is visible (see which fixtures have tests)
- ✓ Fixtures are reused across test stages (semantic_index → symbol_resolution)

## Notes

- Keep existing test structure/organization where sensible
- Focus on fixture-based approach, not test reorganization
- Can improve test organization in follow-up tasks if needed
