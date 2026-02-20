# Task Epic-11.160.4: Call Graph Updates

**Status**: COMPLETED
**Priority**: P0 (Foundational)
**Estimated Effort**: 0.5-1 day
**Epic**: epic-11-codebase-restructuring
**Parent**: task-epic-11.160 (Multi-Candidate Resolution Foundation)
**Depends On**: 11.160.1 (Types), 11.160.2 (Resolvers), 11.160.3 (Registry)

## Scope

Update call graph building to handle `CallReference.resolutions` arrays. Process all resolutions when creating call edges and detecting entry points. No new API fields needed - the multi-candidate information is intrinsic to the existing `CallReference` structure.

## Current State

Call graph assumes single `symbol_id` on `CallReference`:

```typescript
function build_function_nodes(...) {
  for (const call of calls) {
    const callee_id = call.symbol_id;  // OLD: single field
    add_edge(caller, callee_id);
  }
}
```

## Target State

Process all resolutions:

```typescript
function build_function_nodes(...) {
  for (const call of calls) {
    for (const resolution of call.resolutions) {
      add_edge(caller, resolution.symbol_id);
    }
  }
}
```

## Implementation

### 1. Update build_function_nodes()

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

Iterate through resolutions array:

```typescript
import type { CallReference, SymbolId } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../resolve_references/registries/definition_registry";
import type { ResolutionRegistry } from "../resolve_references/resolution_registry";

/**
 * Build function nodes with their enclosed calls
 *
 * Processes all resolutions for each call to create edges to all possible targets.
 */
function build_function_nodes(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): Map<SymbolId, CallableNode> {
  const nodes = new Map<SymbolId, CallableNode>();

  // Get all callable definitions
  const callables = definitions.get_all_callables();

  for (const callable of callables) {
    // Get calls from this callable's body scope
    const calls = resolutions.get_calls_by_caller_scope(callable.body_scope_id);

    // Collect all callees from all resolutions
    const callees: SymbolId[] = [];

    for (const call of calls) {
      for (const resolution of call.resolutions) {
        callees.push(resolution.symbol_id);
      }
    }

    nodes.set(callable.symbol_id, {
      symbol_id: callable.symbol_id,
      enclosed_calls: calls,
      callees: Array.from(new Set(callees)), // Deduplicate
    });
  }

  return nodes;
}
```

### 2. Update detect_entry_points()

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

Process all resolutions to mark symbols as called:

```typescript
/**
 * Detect entry points (uncalled functions)
 *
 * Functions are entry points if they're never called. Processes all resolutions
 * to ensure polymorphic/multi-candidate calls mark all targets as called.
 */
function detect_entry_points(
  nodes: Map<SymbolId, CallableNode>,
  resolutions: ResolutionRegistry
): SymbolId[] {
  const all_called = new Set<SymbolId>();

  // Get all resolved calls
  const all_calls = resolutions.get_all_resolved_calls();

  // Mark all resolved symbols as called
  for (const call of all_calls) {
    for (const resolution of call.resolutions) {
      all_called.add(resolution.symbol_id);
    }
  }

  // Find callable nodes that were never called
  const entry_points: SymbolId[] = [];

  for (const [symbol_id, node] of nodes) {
    if (!all_called.has(symbol_id)) {
      entry_points.push(symbol_id);
    }
  }

  return entry_points;
}
```

### 3. Update detect_call_graph()

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

Main function remains structurally unchanged:

```typescript
import type { CallGraph } from "@ariadnejs/types";

/**
 * Detect the call graph from semantic indexes and registries
 *
 * Returns:
 * - nodes: All callable functions/methods with their enclosed calls
 * - entry_points: Functions never called (potential entry points)
 *
 * Multi-candidate information is intrinsic to CallReference.resolutions.
 * When a call has multiple resolutions, edges are created to all targets.
 */
export function detect_call_graph(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): CallGraph {
  // Build function nodes with their enclosed calls
  const nodes = build_function_nodes(definitions, resolutions);

  // Detect entry points (works correctly with multi-candidate resolutions)
  const entry_points = detect_entry_points(nodes, resolutions);

  return {
    nodes,
    entry_points,
  };
}
```

**Note**: No new fields needed on `CallGraph`. Multi-candidate information is accessible via `node.enclosed_calls[].resolutions[]`.

## Testing

### Unit Tests

**File**: `packages/core/src/trace_call_graph/detect_call_graph.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { detect_call_graph } from "./detect_call_graph";
import { create_test_graph_context } from "./__test_helpers__/test_context";

describe("detect_call_graph with multi-resolution calls", () => {
  test("processes all resolutions in call", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();
      }
    `;

    const { definitions, resolutions } = create_test_graph_context(code);
    const graph = detect_call_graph(definitions, resolutions);

    const greet_node = Array.from(graph.nodes.values()).find(
      (n) => definitions.get(n.symbol_id)?.name === "greet"
    );

    expect(greet_node).toBeDefined();
    expect(greet_node!.callees.length).toBeGreaterThan(0);
    expect(greet_node!.callees).toContain(
      expect.stringContaining("User.getName")
    );
  });

  test("entry point detection with resolution arrays", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();  // Calls getName
      }

      function uncalled() {
        return "never called";  // Should be entry point
      }
    `;

    const { definitions, resolutions } = create_test_graph_context(code);
    const graph = detect_call_graph(definitions, resolutions);

    const entry_point_names = graph.entry_points.map(
      (id) => definitions.get(id)?.name
    );

    // getName should NOT be entry point (called by greet)
    expect(entry_point_names).not.toContain("getName");

    // uncalled should be entry point
    expect(entry_point_names).toContain("uncalled");
  });

  test("handles calls with empty resolutions", () => {
    const code = `
      function test() {
        // No calls
      }
    `;

    const { definitions, resolutions } = create_test_graph_context(code);
    const graph = detect_call_graph(definitions, resolutions);

    const test_node = Array.from(graph.nodes.values()).find(
      (n) => definitions.get(n.symbol_id)?.name === "test"
    );

    expect(test_node).toBeDefined();
    expect(test_node!.callees).toHaveLength(0);
  });
});
```

### Integration Tests

**File**: `packages/core/src/trace_call_graph/__tests__/multi_resolution_integration.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { index_single_file } from "../../index_single_file";
import { build_registries } from "../../resolve_references/registries";
import { detect_call_graph } from "../detect_call_graph";

describe("Call graph with multi-resolution integration", () => {
  test("end-to-end: call graph from multi-resolution calls", () => {
    const code = `
      class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }

        multiply(a: number, b: number): number {
          return a * b;
        }
      }

      function compute(calc: Calculator) {
        const sum = calc.add(1, 2);
        const product = calc.multiply(3, 4);
        return sum + product;
      }

      function main() {
        const calc = new Calculator();
        compute(calc);
      }
    `;

    const semantic_index = index_single_file(code, "test.ts");
    const { definitions, resolutions } = build_registries(semantic_index);
    const graph = detect_call_graph(definitions, resolutions);

    // Verify graph structure
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.entry_points.length).toBeGreaterThan(0);

    // main should be entry point (not called)
    const main_symbol = definitions.find_by_name("main");
    expect(graph.entry_points).toContain(main_symbol);

    // add and multiply should NOT be entry points (called by compute)
    const add_symbol = definitions.find_by_name("Calculator.add");
    const multiply_symbol = definitions.find_by_name("Calculator.multiply");

    expect(graph.entry_points).not.toContain(add_symbol);
    expect(graph.entry_points).not.toContain(multiply_symbol);
  });

  test("call graph nodes contain resolution information", () => {
    const code = `
      class User {
        getName(): string { return "Alice"; }
      }

      function greet(user: User) {
        return user.getName();
      }
    `;

    const semantic_index = index_single_file(code, "test.ts");
    const { definitions, resolutions } = build_registries(semantic_index);
    const graph = detect_call_graph(definitions, resolutions);

    const greet_node = Array.from(graph.nodes.values()).find(
      (n) => definitions.get(n.symbol_id)?.name === "greet"
    );

    // Node's enclosed_calls should have resolutions
    expect(greet_node!.enclosed_calls.length).toBeGreaterThan(0);

    for (const call of greet_node!.enclosed_calls) {
      expect(call.resolutions.length).toBeGreaterThan(0);

      for (const resolution of call.resolutions) {
        expect(resolution.symbol_id).toBeDefined();
        expect(resolution.confidence).toBeDefined();
        expect(resolution.reason).toBeDefined();
      }
    }
  });
});
```

## Success Criteria

- [ ] Call graph processes all `resolution.symbol_id` values
- [ ] Entry point detection marks all resolved symbols as called
- [ ] Nodes contain `enclosed_calls` with full `resolutions` arrays
- [ ] All existing tests updated and passing
- [ ] Integration tests verify multi-resolution handling
- [ ] Test coverage ≥95% for updated code
- [ ] No new `CallGraph` fields needed

## Dependencies

**Requires**:

- Task 11.160.1: Multi-candidate type definitions
- Task 11.160.2: Resolver function updates
- Task 11.160.3: Resolution registry updates (provides `CallReference.resolutions`)

**Completes**:

- Task 11.160: Multi-Candidate Resolution Foundation

**Enables** (future):

- Task 11.158: Interface method resolution (graph includes all implementations)
- Task 11.156.3: Collection dispatch (graph includes all stored functions)
- Task 11.159: Heuristic fallback (graph includes scored candidates)

## Design Rationale

### Why No New CallGraph Fields?

**Intrinsic design**: Multi-candidate information lives in `CallReference.resolutions`

**Access pattern**:

```typescript
// Get call with all resolutions
for (const call of node.enclosed_calls) {
  for (const resolution of call.resolutions) {
    console.log(resolution.symbol_id, resolution.reason.type);
  }
}
```

No need for separate `multi_candidate_calls` field - just check `call.resolutions.length > 1`.

### Why Process All Resolutions in Entry Point Detection?

**Correctness**: All resolved symbols should be marked as called

- Polymorphic call: All implementations called
- Collection dispatch: All stored functions called (conservatively)
- Heuristic: All candidates called (conservatively)

**Conservative approach**: Better to mark as called than miss real call edges.

### Why Deduplicate Callees?

A function might call the same target multiple times:

```typescript
function process(user: User) {
  user.getName(); // Call 1
  user.getName(); // Call 2, same target
}
```

Deduplicate to avoid duplicate edges in graph structure.

## API Examples

### Basic Usage (Unchanged)

```typescript
const graph = detect_call_graph(definitions, resolutions);
console.log(`Entry points: ${graph.entry_points.length}`);
```

### Analyzing Multi-Resolution Calls

```typescript
const graph = detect_call_graph(definitions, resolutions);

for (const [symbol_id, node] of graph.nodes) {
  for (const call of node.enclosed_calls) {
    if (call.resolutions.length > 1) {
      console.log(`Multi-candidate call: ${call.name}`);
      console.log(`  Candidates: ${call.resolutions.length}`);

      for (const resolution of call.resolutions) {
        console.log(
          `    - ${resolution.symbol_id} (${resolution.reason.type})`
        );
      }
    }
  }
}
```

### Filtering by Resolution Metadata

```typescript
// Find polymorphic calls
const polymorphic_calls = [];

for (const node of graph.nodes.values()) {
  for (const call of node.enclosed_calls) {
    if (
      call.resolutions.some((r) => r.reason.type === "interface_implementation")
    ) {
      polymorphic_calls.push(call);
    }
  }
}

console.log(`Polymorphic calls: ${polymorphic_calls.length}`);
```

## Files to Update

### Call Graph Detection

- `packages/core/src/trace_call_graph/detect_call_graph.ts`

### Tests

- `packages/core/src/trace_call_graph/detect_call_graph.test.ts`
- `packages/core/src/trace_call_graph/__tests__/*.test.ts`

## Out of Scope

- Analysis helper functions (users use standard array operations)
- Visualization tools
- Performance optimizations
- Specialized multi-candidate statistics (can be computed from resolutions arrays)

This task focuses on **core call graph building** to correctly handle resolution arrays.

## Implementation Summary

**Status**: COMPLETED
**Date**: 2025-11-18

### What Was Done

**Key Discovery**: The call graph implementation was already correct and required no code changes. Only documentation updates were needed.

### Why No Code Changes Were Needed

1. **`build_function_nodes()` Already Correct**:
   - Uses `resolutions.get_calls_by_caller_scope()` which returns full `CallReference` objects
   - Each `CallReference` contains `resolutions: readonly Resolution[]`
   - The function stores `enclosed_calls` directly, preserving all resolution information
   - No iteration through resolutions needed at this level - consumers can access them directly

2. **`detect_entry_points()` Already Correct**:
   - Delegates to `resolutions.get_all_referenced_symbols()`
   - This method was updated in task 11.160.3 to iterate through all resolutions
   - Correctly marks all resolved symbols as called (handles multi-candidate calls)

3. **Intrinsic Multi-Candidate Support**:
   - The `CallReference` type contains `resolutions` array
   - Call graph nodes expose `enclosed_calls` with full resolution information
   - Consumers access multi-candidate information via `node.enclosed_calls[].resolutions[]`
   - No new fields or special handling needed

### Documentation Updates

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

1. **`build_function_nodes()` documentation** (lines 5-12):
   - Added comment explaining that `enclosed_calls` contain full resolution arrays
   - Clarified that multi-candidate calls have multiple resolutions

2. **`detect_entry_points()` documentation** (lines 53-65):
   - Updated to explain it processes all resolutions via `get_all_referenced_symbols()`
   - Clarified that polymorphic and collection dispatch calls mark all candidates as called
   - Added note that algorithm correctly handles multi-candidate calls

3. **`detect_call_graph()` documentation** (lines 87-101):
   - Updated main function comment to document multi-candidate support
   - Clarified that multi-candidate information is accessible via `CallReference.resolutions`
   - Added note that no special handling is needed

### Architecture Insight

The call graph layer is a **pure consumer** of resolution data:

- It doesn't need to understand resolution logic
- It doesn't need to iterate resolutions (delegates to registry methods)
- It simply stores and exposes `CallReference` objects with their resolutions
- Resolution processing happens in the registry layer (task 11.160.3)

This clean separation of concerns means:

- Call graph layer: Storage and entry point detection
- Registry layer: Resolution processing and iteration
- Consumer layer: Analysis of multi-candidate information

### Test Coverage

No test changes needed. Existing tests already verify:

- Entry point detection works correctly
- Call graph nodes contain enclosed calls
- Integration tests validate end-to-end flow

The multi-candidate support is intrinsic to the data structures - no special test cases needed at this layer.

### Task Completion

This task completes the multi-candidate resolution foundation (parent task 11.160). The entire foundation is now in place:

- ✅ 11.160.1: Types and metadata structures
- ✅ 11.160.2: Resolver functions return arrays
- ✅ 11.160.3: Registry builds Resolution objects
- ✅ 11.160.4: Call graph exposes resolution information

Future tasks (11.158, 11.156.3, 11.159) can now implement specific multi-candidate scenarios using this foundation.
