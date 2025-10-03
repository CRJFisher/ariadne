# Task epic-11.116.7: Create call_graph Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.6
**Priority:** Medium
**Created:** 2025-10-03

## Overview

Create NEW integration tests for `detect_call_graph.ts` for all four supported languages. Currently, there are no comprehensive language-specific integration tests for call graph detection - this task fills that gap using the fixture pipeline approach.

## Objectives

1. Create TypeScript call_graph integration tests
2. Create Python call_graph integration tests
3. Create Rust call_graph integration tests
4. Create JavaScript call_graph integration tests
5. Validate call graph detection across all language features

## Key Characteristics

This is different from previous tasks:
- **Creating NEW test files** (not refactoring existing ones)
- Tests use **resolved_symbols fixtures as input**
- Tests validate **call graph JSON fixtures as output**
- Completes the three-stage fixture pipeline

## Test File Structure

Create new test files:
```
packages/core/src/trace_call_graph/
├── detect_call_graph.ts
├── detect_call_graph.test.ts           # Existing unit tests (keep)
├── detect_call_graph.typescript.test.ts # NEW
├── detect_call_graph.python.test.ts     # NEW
├── detect_call_graph.rust.test.ts       # NEW
└── detect_call_graph.javascript.test.ts # NEW
```

## Common Test Pattern

```typescript
import { describe, it, expect } from "vitest";
import { detect_call_graph } from "./detect_call_graph";
import {
  load_resolved_symbols_fixture,
  load_call_graph_fixture,
  compare_call_graph,
  deserialize_resolved_symbols
} from "../tests/fixtures/test_helpers";

describe("Call Graph Detection - TypeScript", () => {
  describe("Classes", () => {
    it("should detect method calls within class", () => {
      // Load resolved_symbols as input
      const resolved_symbols_json = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/classes/basic_class.resolved_symbols.json"
      );
      const resolved_symbols = deserialize_resolved_symbols(resolved_symbols_json);

      // Detect call graph
      const actual = detect_call_graph(resolved_symbols);

      // Load expected output
      const expected = load_call_graph_fixture(
        "typescript/call_graph/classes/basic_class.call_graph.json"
      );

      // Compare
      expect(compare_call_graph(actual, expected)).toEqual({ matches: true });
    });

    it("should identify entry points (uncalled methods)", () => {
      const resolved_symbols_json = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/classes/entry_points.resolved_symbols.json"
      );
      const resolved_symbols = deserialize_resolved_symbols(resolved_symbols_json);
      const actual = detect_call_graph(resolved_symbols);
      const expected = load_call_graph_fixture(
        "typescript/call_graph/classes/entry_points.call_graph.json"
      );

      expect(compare_call_graph(actual, expected)).toEqual({ matches: true });

      // Additional assertion: verify specific entry points
      expect(actual.entry_points).toContain("symbol:...:function:main:...");
    });
  });

  describe("Functions", () => {
    it("should detect function call chains", () => {
      // Test A calls B calls C
      const resolved_symbols_json = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/functions/call_chain.resolved_symbols.json"
      );
      const resolved_symbols = deserialize_resolved_symbols(resolved_symbols_json);
      const actual = detect_call_graph(resolved_symbols);
      const expected = load_call_graph_fixture(
        "typescript/call_graph/functions/call_chain.call_graph.json"
      );

      expect(compare_call_graph(actual, expected)).toEqual({ matches: true });
    });

    it("should handle recursive function calls", () => {
      // Test function that calls itself
      const resolved_symbols_json = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/functions/recursive.resolved_symbols.json"
      );
      const resolved_symbols = deserialize_resolved_symbols(resolved_symbols_json);
      const actual = detect_call_graph(resolved_symbols);
      const expected = load_call_graph_fixture(
        "typescript/call_graph/functions/recursive.call_graph.json"
      );

      expect(compare_call_graph(actual, expected)).toEqual({ matches: true });
    });
  });
});
```

## Additional Test Helpers

Add to `packages/core/tests/fixtures/test_helpers.ts`:

```typescript
/**
 * Load a call_graph JSON fixture
 */
export function load_call_graph_fixture(path: string): CallGraphFixture

/**
 * Deserialize resolved_symbols JSON back to ResolvedSymbols object
 */
export function deserialize_resolved_symbols(json: ResolvedSymbolsFixture): ResolvedSymbols

/**
 * Compare actual call graph against expected fixture
 */
export function compare_call_graph(
  actual: CallGraph,
  expected: CallGraphFixture
): ComparisonResult

/**
 * Serialize call graph to fixture format
 */
export function serialize_call_graph(graph: CallGraph): CallGraphFixture
```

## Sub-tasks

### 116.7.1: Create TypeScript call_graph Tests

**New file**: `packages/core/src/trace_call_graph/detect_call_graph.typescript.test.ts`

**Test categories to cover:**

1. **Classes**:
   - Method calls within class
   - Constructor calls
   - Static method calls
   - Method calls on inherited methods

2. **Functions**:
   - Function call chains
   - Recursive functions
   - Nested function calls
   - Arrow functions

3. **Entry Points**:
   - Exported functions never called internally
   - Main functions
   - Top-level code

4. **Edge Cases**:
   - Circular call graphs
   - Unresolved external calls
   - Method calls on unknown types

**Example tests:**
```typescript
describe("Call Graph Detection - TypeScript", () => {
  describe("Classes", () => {
    it("should detect method calls within class", () => { /* ... */ });
    it("should detect constructor calls", () => { /* ... */ });
    it("should detect static method calls", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("should detect function call chains", () => { /* ... */ });
    it("should handle recursive functions", () => { /* ... */ });
  });

  describe("Entry Points", () => {
    it("should identify uncalled functions as entry points", () => { /* ... */ });
    it("should exclude called functions from entry points", () => { /* ... */ });
  });

  describe("Edge Cases", () => {
    it("should handle circular call graphs", () => { /* ... */ });
  });
});
```

**Deliverables:**
- [ ] Test file created with comprehensive coverage
- [ ] All fixture combinations tested
- [ ] All tests passing
- [ ] Entry point detection validated

### 116.7.2: Create Python call_graph Tests

**New file**: `packages/core/src/trace_call_graph/detect_call_graph.python.test.ts`

**Python-specific categories:**

1. **Classes**:
   - Method calls (self.method())
   - Class method calls (@classmethod)
   - Static method calls (@staticmethod)

2. **Functions**:
   - Function calls
   - Decorator chains (function wrapping)
   - Generator functions

3. **Modules**:
   - Cross-module function calls
   - Import resolution in call graph

**Deliverables:**
- [ ] Python test file created
- [ ] Python-specific features covered
- [ ] All tests passing

### 116.7.3: Create Rust call_graph Tests

**New file**: `packages/core/src/trace_call_graph/detect_call_graph.rust.test.ts`

**Rust-specific categories:**

1. **Functions**:
   - Function calls
   - Closure calls
   - Method calls on self

2. **Impl Blocks**:
   - Method calls within impl
   - Associated function calls

3. **Traits**:
   - Trait method calls
   - Default trait implementations

4. **Modules**:
   - Cross-module function calls
   - Pub/private visibility

**Deliverables:**
- [ ] Rust test file created
- [ ] Rust-specific features covered
- [ ] All tests passing

### 116.7.4: Create JavaScript call_graph Tests

**New file**: `packages/core/src/trace_call_graph/detect_call_graph.javascript.test.ts`

**JavaScript-specific categories:**

1. **Classes**:
   - ES6 class method calls
   - Constructor calls

2. **Functions**:
   - Function calls
   - Arrow function calls
   - Callback functions

3. **Modules**:
   - CommonJS require() calls
   - ES6 import/export
   - Mixed module systems

**Deliverables:**
- [ ] JavaScript test file created
- [ ] JavaScript-specific features covered
- [ ] All tests passing

## Comparison Strategy

The `compare_call_graph` function should validate:

1. **Function nodes match**:
   - All expected nodes present
   - Node properties match (symbol_id, name, location)

2. **Enclosed calls match**:
   - Each node has expected enclosed_calls
   - Call references match (name, location, resolved_to)

3. **Entry points match**:
   - All expected entry points identified
   - No unexpected entry points
   - Entry point criteria correct

4. **Graph structure**:
   - Call relationships are correct
   - No missing edges
   - No spurious edges

## Testing Strategy

### Unit vs Integration

- **Existing unit tests** (`detect_call_graph.test.ts`): Test core logic with minimal inputs
- **New integration tests** (116.7.x): Test with realistic code fixtures across all language features

Both are valuable and should coexist.

### Fixture Selection

Use fixtures that demonstrate:
- **Simple cases**: Single function call
- **Complex cases**: Call chains, recursion, circular graphs
- **Entry points**: Functions never called internally
- **Edge cases**: External calls, unresolved references

### Validation Focus

Key things to validate:
1. **Completeness**: Are all calls detected?
2. **Accuracy**: Are calls correctly attributed to enclosing functions?
3. **Entry points**: Are truly uncalled functions identified?
4. **No false positives**: Are non-calls excluded?

## Special Considerations

### Entry Point Semantics

Different languages may have different entry point conventions:
- **TypeScript**: Exported functions, main(), top-level code
- **Python**: `if __name__ == "__main__"`, module-level code
- **Rust**: fn main(), #[test] functions
- **JavaScript**: Exported functions, module.exports

Fixtures should document language-specific entry point behavior.

### External Calls

Calls to external libraries/APIs:
- May appear in `enclosed_calls` but not resolve to internal nodes
- Should be present in call graph
- Should not affect entry point detection

### Circular Dependencies

Test cases with circular call graphs:
- A calls B, B calls A
- Should not cause infinite loops
- Both should appear in each other's enclosed_calls

## Acceptance Criteria

- [ ] All four language test files created (116.7.1 - 116.7.4)
- [ ] Additional test helpers implemented
- [ ] All tests passing
- [ ] Entry point detection validated for each language
- [ ] Edge cases covered (recursion, circular graphs, external calls)
- [ ] Comparison logic validates all call graph aspects
- [ ] Documentation of entry point semantics per language

## Estimated Effort

- **Test helpers implementation**: 2 hours
- **TypeScript tests**: 2.5 hours
- **Python tests**: 2 hours
- **Rust tests**: 2 hours
- **JavaScript tests**: 1.5 hours
- **Debugging and validation**: 2 hours
- **Total**: ~12 hours

## Benefits

After completion:
- ✓ Call graph detection validated across all languages
- ✓ Completes three-stage fixture pipeline
- ✓ Entry point detection validated
- ✓ Easy to add new test cases
- ✓ Comprehensive coverage of call graph features
- ✓ Fills major testing gap in codebase

## Notes

- This is the final piece of the fixture pipeline
- May reveal bugs or limitations in call graph detection
- Tests document expected behavior for entry point detection
- Fixtures can be used for performance benchmarking
