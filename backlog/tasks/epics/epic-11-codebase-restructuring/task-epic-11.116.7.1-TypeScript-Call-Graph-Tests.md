# Task epic-11.116.7.1: CREATE TypeScript call_graph Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** 116.7.0
**Language:** TypeScript
**Priority:** High
**Estimated Effort:** 2.5 hours

## Objective

CREATE NEW integration test file for TypeScript call graph detection.

## New Test File

**Location:** `packages/core/src/trace_call_graph/detect_call_graph.typescript.test.ts`

## Test Organization

```typescript
import { describe, it, expect } from "vitest";
import { detect_call_graph } from "./detect_call_graph";
import {
  load_resolved_symbols_fixture,
  load_call_graph_fixture,
  deserialize_resolved_symbols,
  compare_call_graph
} from "../tests/fixtures/test_helpers";

describe("Call Graph Detection - TypeScript", () => {
  describe("Classes", () => {
    it("should detect method calls within class", () => {
      const resolved_symbols_json = load_resolved_symbols_fixture(
        "typescript/resolved_symbols/classes/basic_class.resolved_symbols.json"
      );
      const resolved_symbols = deserialize_resolved_symbols(resolved_symbols_json);
      const actual = detect_call_graph(resolved_symbols);
      const expected = load_call_graph_fixture(
        "typescript/call_graph/classes/basic_class.call_graph.json"
      );
      expect(compare_call_graph(actual, expected)).toEqual({ matches: true });
    });

    it("should detect constructor calls", () => { /* ... */ });
    it("should detect static method calls", () => { /* ... */ });
  });

  describe("Functions", () => {
    it("should detect function call chains", () => { /* ... */ });
    it("should handle recursive functions", () => { /* ... */ });
  });

  describe("Entry Points", () => {
    it("should identify uncalled functions as entry points", () => { /* ... */ });
  });

  describe("Edge Cases", () => {
    it("should handle circular call graphs", () => { /* ... */ });
  });
});
```

## Test Coverage

- [ ] Method calls within classes
- [ ] Constructor calls
- [ ] Static method calls
- [ ] Function call chains
- [ ] Recursive functions
- [ ] Entry point detection
- [ ] Circular call graphs

## Deliverables

- [ ] NEW test file created
- [ ] Comprehensive TypeScript call graph tests
- [ ] All tests passing
- [ ] Entry point detection validated
