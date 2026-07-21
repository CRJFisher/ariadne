# Task epic-11.116.6: Call Graph Integration Tests with JSON Fixtures

**Status:** Not Started
**Parent:** task-epic-11.116
**Depends On:** task-epic-11.116.4
**Priority:** High
**Created:** 2025-10-14

## Overview

Create comprehensive language-specific integration tests for call graph detection using JSON fixtures as inputs. These tests validate that `detect_call_graph` works correctly with realistic code across all supported languages.

**Key Point:** We're **creating new tests**, not refactoring existing ones. Current tests are unit tests; these are integration tests with realistic fixtures.

## Current State

**Existing tests:** `packages/core/src/trace_call_graph/detect_call_graph.test.ts`
- Status: Good unit test coverage
- Approach: Minimal, hand-crafted test data
- Coverage: Core logic, edge cases

**What's missing:** Language-specific integration tests with realistic code patterns.

## Objectives

1. Create integration test files for all 4 languages
2. Test realistic call patterns per language
3. Validate entry point detection
4. Use JSON fixtures as inputs (no manual construction)
5. Verify call graph structure with code assertions

## Test Files to Create

```
packages/core/src/trace_call_graph/
├── detect_call_graph.test.ts              # Existing unit tests (keep)
├── detect_call_graph.typescript.integration.test.ts  # NEW
├── detect_call_graph.python.integration.test.ts      # NEW
├── detect_call_graph.rust.integration.test.ts        # NEW
└── detect_call_graph.javascript.integration.test.ts  # NEW
```

## Test Pattern

**Standard pattern for all tests:**

```typescript
import { describe, it, expect } from "vitest";
import { detect_call_graph } from "./detect_call_graph";
import { load_fixture, build_registries } from "../../tests/fixtures/test_helpers";

describe("Call Graph Detection - TypeScript Integration", () => {
  describe("Function Call Chains", () => {
    it("should detect simple call chain (A → B → C)", () => {
      // Load fixture
      const index = load_fixture("typescript/functions/call_chains.json");

      // Build registries and detect call graph
      const { definitions, resolutions } = build_registries([index]);
      const graph = detect_call_graph(definitions, resolutions);

      // Verify nodes exist
      expect(graph.nodes.size).toBeGreaterThan(0);

      // Find specific functions in graph
      const main = find_node_by_name(graph, "main");
      const process_data = find_node_by_name(graph, "processData");
      const fetch_data = find_node_by_name(graph, "fetchData");

      expect(main).toBeDefined();
      expect(process_data).toBeDefined();
      expect(fetch_data).toBeDefined();

      // Verify call relationships
      expect(main.enclosed_calls).toContainEqual(
        expect.objectContaining({ name: "processData" })
      );
      expect(process_data.enclosed_calls).toContainEqual(
        expect.objectContaining({ name: "fetchData" })
      );

      // Verify entry points
      expect(graph.entry_points).toContain(main.symbol_id);
      expect(graph.entry_points).not.toContain(process_data.symbol_id);
      expect(graph.entry_points).not.toContain(fetch_data.symbol_id);
    });
  });
});
```

## Language-Specific Test Coverage

### TypeScript Integration Tests

**File:** `detect_call_graph.typescript.integration.test.ts`

**Test categories:**

1. **Function Call Chains**
   - Simple chain (A → B → C)
   - Branching (A → B, A → C)
   - Deep chains (5+ levels)

2. **Class Method Calls**
   - Constructor calling instance methods
   - Method calling other methods (this.foo())
   - Static method calls
   - Inherited method calls

3. **Async Patterns**
   - Async function calling other async functions
   - Promise chains
   - Await call detection

4. **Entry Point Detection**
   - Exported but uncalled functions
   - Main function detection
   - Class methods called externally vs internally

5. **Edge Cases**
   - Recursive functions (should appear in own enclosed_calls)
   - Mutual recursion (A → B → A)
   - Unresolved external calls

**Fixtures needed:**
- `typescript/functions/call_chains.json`
- `typescript/functions/recursive.json`
- `typescript/classes/methods_calling_methods.json`
- `typescript/functions/async_chains.json`
- `typescript/functions/entry_points.json`

### Python Integration Tests

**File:** `detect_call_graph.python.integration.test.ts`

**Test categories:**

1. **Function Calls**
   - Basic function calls
   - Nested function definitions

2. **Class Method Calls**
   - Instance method calls (self.method())
   - Class method calls (@classmethod)
   - Static method calls (@staticmethod)

3. **Decorator Patterns**
   - Function calling decorated function
   - Decorator chains

4. **Entry Points**
   - `if __name__ == "__main__"` detection
   - Module-level code

**Fixtures needed:**
- `python/functions/basic_calls.json`
- `python/classes/method_calls.json`
- `python/functions/decorators.json`

### Rust Integration Tests

**File:** `detect_call_graph.rust.integration.test.ts`

**Test categories:**

1. **Function Calls**
   - Basic function calls
   - Closure calls

2. **Method Calls (Impl Blocks)**
   - Methods calling other methods (self.foo())
   - Associated function calls (Type::func())

3. **Trait Method Calls**
   - Trait method implementations

4. **Entry Points**
   - fn main() detection
   - Pub functions never called internally

**Fixtures needed:**
- `rust/functions/basic_calls.json`
- `rust/impls/method_calls.json`
- `rust/functions/main.json`

### JavaScript Integration Tests

**File:** `detect_call_graph.javascript.integration.test.ts`

**Test categories:**

1. **Function Calls**
   - Function declarations
   - Arrow functions
   - Function expressions

2. **Class Method Calls**
   - ES6 class methods
   - Constructor calls

3. **Callback Patterns**
   - Higher-order functions
   - Callback functions

4. **Entry Points**
   - Exported functions
   - Module.exports detection

**Fixtures needed:**
- `javascript/functions/basic_calls.json`
- `javascript/classes/method_calls.json`
- `javascript/functions/callbacks.json`

## Implementation Plan

### Phase 1: Create Test Helpers (1 hour)

Add to `test_helpers.ts`:

```typescript
/**
 * Find call graph node by function/method name
 */
export function find_node_by_name(
  graph: CallGraph,
  name: string
): CallableNode | undefined {
  return Array.from(graph.nodes.values()).find(node => node.name === name);
}

/**
 * Find call graph node by symbol ID
 */
export function find_node_by_id(
  graph: CallGraph,
  symbol_id: SymbolId
): CallableNode | undefined {
  return graph.nodes.get(symbol_id);
}

/**
 * Assert that node A calls node B
 */
export function expect_calls(
  caller: CallableNode,
  callee_name: string
): void {
  const call = caller.enclosed_calls.find(c => c.name === callee_name);
  expect(call).toBeDefined();
}

/**
 * Assert that symbol is an entry point
 */
export function expect_entry_point(
  graph: CallGraph,
  symbol_id: SymbolId
): void {
  expect(graph.entry_points).toContain(symbol_id);
}

/**
 * Assert that symbol is NOT an entry point
 */
export function expect_not_entry_point(
  graph: CallGraph,
  symbol_id: SymbolId
): void {
  expect(graph.entry_points).not.toContain(symbol_id);
}
```

### Phase 2: TypeScript Tests (2-3 hours)

Create `detect_call_graph.typescript.integration.test.ts` with all test categories.

**Example structure:**
```typescript
describe("Call Graph Detection - TypeScript Integration", () => {
  describe("Function Call Chains", () => {
    it("should detect simple call chain", () => { /* ... */ });
    it("should detect branching calls", () => { /* ... */ });
    it("should detect recursive calls", () => { /* ... */ });
  });

  describe("Class Method Calls", () => {
    it("should detect constructor → method calls", () => { /* ... */ });
    it("should detect method → method calls", () => { /* ... */ });
  });

  describe("Entry Point Detection", () => {
    it("should identify exported uncalled functions", () => { /* ... */ });
    it("should exclude called functions", () => { /* ... */ });
  });
});
```

### Phase 3: Other Languages (2-3 hours)

Create integration tests for Python, Rust, JavaScript using similar patterns.

**Strategy:**
- Start with minimal test set (1-2 tests per category)
- Can expand coverage over time
- Focus on language-specific patterns

### Phase 4: Create Missing Fixtures (1-2 hours)

If fixtures don't exist for test cases:
1. Create code fixture (116.3 pattern)
2. Generate JSON fixture (116.4 workflow)
3. Use in tests

## Deliverables

- [ ] Test helper functions for call graphs
- [ ] `detect_call_graph.typescript.integration.test.ts` (comprehensive)
- [ ] `detect_call_graph.python.integration.test.ts` (basic coverage)
- [ ] `detect_call_graph.rust.integration.test.ts` (basic coverage)
- [ ] `detect_call_graph.javascript.integration.test.ts` (basic coverage)
- [ ] All tests passing
- [ ] Any missing fixtures created

## Success Criteria

- ✅ Integration tests exist for all 4 languages
- ✅ Tests use JSON fixtures (no manual construction)
- ✅ TypeScript has comprehensive coverage (10+ tests)
- ✅ Other languages have basic coverage (3-5 tests each)
- ✅ Entry point detection validated
- ✅ Call chains validated
- ✅ Language-specific patterns tested
- ✅ All tests passing

## Estimated Effort

**6-8 hours**
- 1 hour: Create test helpers
- 2-3 hours: TypeScript integration tests
- 2-3 hours: Python, Rust, JavaScript tests
- 1-2 hours: Create missing fixtures
- 1 hour: Review and refinement

## Next Steps

After completion:
- Proceed to **116.7**: Optional semantic index verification tests
- Proceed to **116.8**: Documentation

## Notes

- These tests validate the entire pipeline: fixtures → registries → call graph
- Tests are realistic, not minimal (unlike unit tests)
- Same fixtures used here were already used in registry tests (116.5)
- Entry point detection is critical - test thoroughly
- Recursive and circular patterns are important edge cases
- Can expand coverage incrementally over time
- Consider this a foundation - more tests can be added as needed
