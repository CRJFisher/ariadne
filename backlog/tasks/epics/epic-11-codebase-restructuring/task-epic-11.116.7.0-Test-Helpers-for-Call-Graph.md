# Task epic-11.116.7.0: Test Helpers for call_graph Tests

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** 116.6.0
**Priority:** High (blocks 116.7.1-116.7.4)
**Estimated Effort:** 2 hours

## Objective

Extend test helpers to support call_graph tests. These tests use resolved_symbols JSON as input and compare against call_graph JSON.

## Additional Test Helpers

**Location:** `packages/core/tests/fixtures/test_helpers.ts` (extend existing)

### 1. load_call_graph_fixture()

```typescript
export function load_call_graph_fixture(path: string): CallGraphFixture
```

### 2. deserialize_resolved_symbols()

```typescript
export function deserialize_resolved_symbols(json: ResolvedSymbolsFixture): ResolvedSymbols
```

Converts JSON back to ResolvedSymbols with proper Maps and types.

### 3. compare_call_graph()

```typescript
export function compare_call_graph(
  actual: CallGraph,
  expected: CallGraphFixture
): ComparisonResult
```

Validates:
- All function nodes match
- Enclosed calls match for each node
- Entry points identified correctly
- Call graph structure correct

### 4. serialize_call_graph()

```typescript
export function serialize_call_graph(graph: CallGraph): CallGraphFixture
```

### 5. Supporting Types

```typescript
export interface CallGraphFixture {
  nodes: { [key: string]: FunctionNodeFixture };
  entry_points: string[]; // Array of SymbolId
}

export interface FunctionNodeFixture {
  symbol_id: string;
  name: string;
  location: LocationFixture;
  enclosed_calls: CallReferenceFixture[];
}
```

## Deliverables

- [ ] Extended helpers implemented
- [ ] Deserialization of resolved_symbols working
- [ ] Comparison validates nodes and entry points
- [ ] Ready for 116.7.1-116.7.4
