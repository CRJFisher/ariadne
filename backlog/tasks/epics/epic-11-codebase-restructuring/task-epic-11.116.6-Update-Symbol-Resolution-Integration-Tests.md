# Task epic-11.116.6: Update symbol_resolution Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.5
**Priority:** Medium
**Created:** 2025-10-03

## Overview

Refactor the existing `symbol_resolution.<language>.test.ts` files to use the new JSON fixture approach. Tests will load semantic_index JSON fixtures as input, run symbol resolution, and compare against resolved_symbols JSON fixtures.

## Objectives

1. Refactor TypeScript symbol_resolution tests
2. Refactor Python symbol_resolution tests
3. Refactor Rust symbol_resolution tests
4. Refactor JavaScript symbol_resolution tests
5. Ensure comprehensive coverage using fixture pipeline

## Key Difference from semantic_index Tests

Symbol resolution tests have TWO fixture inputs:
1. **Input**: `semantic_index` JSON fixture (output from stage 1)
2. **Expected output**: `resolved_symbols` JSON fixture (golden output for stage 2)

This creates the **pipeline effect** - ensuring symbol_resolution tests cover all cases tested in semantic_index.

## Common Test Pattern

```typescript
import { describe, it, expect } from "vitest";
import { resolve_symbols } from "./symbol_resolution";
import {
  load_semantic_index_fixture,
  load_resolved_symbols_fixture,
  compare_resolved_symbols,
  deserialize_semantic_index
} from "../tests/fixtures/test_helpers";

describe("Symbol Resolution - TypeScript", () => {
  describe("Classes", () => {
    it("should resolve class constructor calls", () => {
      // Load semantic_index as input
      const semantic_index_json = load_semantic_index_fixture(
        "typescript/semantic_index/classes/basic_class.semantic_index.json"
      );
      const semantic_index = deserialize_semantic_index(semantic_index_json);

      // Run symbol resolution
      const actual = resolve_symbols([semantic_index]);

      // Load expected output
      const expected = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/classes/basic_class.resolved_symbols.json"
      );

      // Compare
      expect(compare_resolved_symbols(actual, expected)).toEqual({ matches: true });
    });

    it("should resolve method calls on class instances", () => {
      const semantic_index_json = load_semantic_index_fixture(
        "typescript/semantic_index/classes/methods.semantic_index.json"
      );
      const semantic_index = deserialize_semantic_index(semantic_index_json);
      const actual = resolve_symbols([semantic_index]);
      const expected = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/classes/methods.resolved_symbols.json"
      );
      expect(compare_resolved_symbols(actual, expected)).toEqual({ matches: true });
    });
  });

  describe("Functions", () => {
    it("should resolve function calls in local scope", () => {
      // Similar pattern...
    });
  });
});
```

## Additional Test Helpers

Add to `packages/core/tests/fixtures/test_helpers.ts`:

```typescript
/**
 * Load a resolved_symbols JSON fixture
 */
export function load_resolved_symbols_fixture(path: string): ResolvedSymbolsFixture

/**
 * Deserialize semantic_index JSON back to SemanticIndex object
 * (Reverses the serialization done during fixture generation)
 */
export function deserialize_semantic_index(json: SemanticIndexFixture): SemanticIndex

/**
 * Compare actual resolved symbols against expected fixture
 */
export function compare_resolved_symbols(
  actual: ResolvedSymbols,
  expected: ResolvedSymbolsFixture
): ComparisonResult

/**
 * Serialize resolved symbols to fixture format
 */
export function serialize_resolved_symbols(resolved: ResolvedSymbols): ResolvedSymbolsFixture
```

## Sub-tasks

### 116.6.1: Refactor TypeScript symbol_resolution Tests

**Current file**: `packages/core/src/resolve_references/symbol_resolution.typescript.test.ts`

**Current approach** (from earlier reading):
- Tests use `create_test_index()` helper to build semantic indexes inline
- Tests manually construct definitions, scopes, references
- Many tests are marked `.todo()` pending feature implementation

**New approach**:
1. Replace `create_test_index()` calls with `load_semantic_index_fixture()`
2. Use real fixtures instead of minimal hand-crafted indexes
3. Keep `.todo()` tests but update them to use fixtures
4. Organize by feature category

**Special consideration for .todo() tests:**
- These tests document features not yet implemented
- Keep them as `.todo()` but update to fixture approach
- When features are implemented, fixtures can be regenerated and tests will pass

**Example refactor:**
```typescript
// BEFORE:
it.todo("should resolve interface-based method calls", () => {
  const index = create_test_index("test.ts", {
    interfaces: new Map([...]),
    variables: new Map([...]),
    references: [...]
  });
  // ... manual test setup
});

// AFTER:
it.todo("should resolve interface-based method calls", () => {
  const semantic_index_json = load_semantic_index_fixture(
    "typescript/semantic_index/interfaces/method_calls.semantic_index.json"
  );
  const semantic_index = deserialize_semantic_index(semantic_index_json);
  const actual = resolve_symbols([semantic_index]);
  const expected = load_resolved_symbols_fixture(
    "typescript/resolved_symbols/interfaces/method_calls.resolved_symbols.json"
  );
  expect(compare_resolved_symbols(actual, expected)).toEqual({ matches: true });
});
```

**Deliverables:**
- [ ] All TypeScript tests refactored to use fixtures
- [ ] `.todo()` tests updated but still marked as todo
- [ ] Tests organized by category
- [ ] All non-todo tests passing

### 116.6.2: Refactor Python symbol_resolution Tests

**Current file**: `packages/core/src/resolve_references/symbol_resolution.python.test.ts`

**Actions:**
- Same approach as 116.6.1 but for Python
- Categories: classes, functions, modules, decorators

**Deliverables:**
- [ ] All Python tests refactored
- [ ] All non-todo tests passing

### 116.6.3: Refactor Rust symbol_resolution Tests

**Current file**: `packages/core/src/resolve_references/symbol_resolution.rust.test.ts`

**Actions:**
- Same approach but for Rust
- Categories: structs, impl blocks, traits, functions, modules

**Deliverables:**
- [ ] All Rust tests refactored
- [ ] All non-todo tests passing

### 116.6.4: Refactor JavaScript symbol_resolution Tests

**Current file**: `packages/core/src/resolve_references/symbol_resolution.javascript.test.ts`

**Actions:**
- Same approach but for JavaScript
- Categories: functions, classes, modules

**Deliverables:**
- [ ] All JavaScript tests refactored
- [ ] All non-todo tests passing

## Comparison Strategy

The `compare_resolved_symbols` function should check:

1. **Definitions match**:
   - All expected definitions present
   - Definition properties match (name, type, location)

2. **References match**:
   - All expected references present
   - Reference properties match (name, location, type, scope)

3. **Resolution mapping matches**:
   - `resolved_references` map is correct (LocationKey → SymbolId)
   - All expected resolutions present
   - No unexpected resolutions

4. **Reverse mapping matches**:
   - `references_to_symbol` is correct (SymbolId → LocationKey[])

5. **Handle partial resolution**:
   - Some references may intentionally not resolve (external symbols)
   - Fixture should document expected unresolved references

## Handling .todo() Tests

For tests marked `.todo()`:

1. **Create fixtures anyway**: Even if feature isn't implemented, create the fixtures showing expected behavior
2. **Mark test as .todo()**: Test will be skipped but documented
3. **When feature is implemented**:
   - Regenerate fixtures
   - Remove `.todo()` marker
   - Test should pass automatically

This documents expected behavior and makes it easy to validate when features are completed.

## Cross-File Resolution Tests

Some tests may require **multiple semantic index files** (for cross-file symbol resolution):

```typescript
it("should resolve imports from other files", () => {
  // Load multiple semantic indexes
  const index1_json = load_semantic_index_fixture("typescript/semantic_index/modules/exports.semantic_index.json");
  const index2_json = load_semantic_index_fixture("typescript/semantic_index/modules/imports.semantic_index.json");

  const index1 = deserialize_semantic_index(index1_json);
  const index2 = deserialize_semantic_index(index2_json);

  // Resolve with multiple files
  const actual = resolve_symbols([index1, index2]);

  // Expected output might cover both files or just the importing file
  const expected = load_resolved_symbols_fixture("typescript/resolved_symbols/modules/imports.resolved_symbols.json");

  expect(compare_resolved_symbols(actual, expected)).toEqual({ matches: true });
});
```

## Migration Strategy

**Incremental approach:**

1. Start with one category (e.g., "Classes")
2. Refactor those tests to fixtures
3. Verify they pass
4. Move to next category
5. Repeat until all categories covered

Can be done per-language or per-category across all languages.

## Acceptance Criteria

- [ ] All four language test files refactored (116.6.1 - 116.6.4)
- [ ] Additional test helpers implemented
- [ ] All non-todo tests passing
- [ ] `.todo()` tests updated to use fixtures
- [ ] Cross-file resolution tests working (if applicable)
- [ ] Comparison logic handles partial resolution correctly
- [ ] Test coverage equivalent or better than before

## Estimated Effort

- **Test helpers implementation**: 2 hours
- **TypeScript test refactor**: 2.5 hours
- **Python test refactor**: 2 hours
- **Rust test refactor**: 2 hours
- **JavaScript test refactor**: 1.5 hours
- **Cross-file resolution support**: 1 hour
- **Debugging and fixes**: 2 hours
- **Total**: ~13 hours

## Benefits

After completion:
- ✓ Symbol resolution tests automatically cover all semantic_index features
- ✓ Pipeline integrity verified (semantic_index output → symbol_resolution input)
- ✓ Easy to add new test cases (just add fixture pair)
- ✓ `.todo()` tests document expected behavior with real examples
- ✓ Fixtures are reused in next stage (call_graph)

## Notes

- This task validates the **fixture pipeline** concept
- Any gaps in semantic_index fixtures will be obvious here
- May discover that some fixtures need cross-file variants
- Deserialization logic must handle all semantic_index types correctly
