# Sub-Task 11.140.9: Performance Benchmarking and Optimization

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: Medium
**Estimated Effort**: 1-2 hours

---

## Goal

Benchmark the new registry-based `detect_call_graph` against the old implementation to verify performance improvements and identify any bottlenecks.

---

## Benchmarking Strategy

### Metrics to Measure

1. **Execution Time**
   - Total time for detect_call_graph
   - Time breakdown: build_function_nodes vs detect_entry_points

2. **Memory Usage**
   - Peak memory during execution
   - Size of intermediate data structures

3. **Scalability**
   - Performance with increasing number of functions
   - Performance with increasing call depth

---

## Test Scenarios

### Small Codebase (Baseline)
- **10 functions**, 20 calls
- **Expected**: < 10ms

### Medium Codebase
- **100 functions**, 200 calls
- **Expected**: < 50ms

### Large Codebase
- **1000 functions**, 2000 calls
- **Expected**: < 500ms

### Deep Call Chain
- **100 functions** in a chain (A→B→C→...→Z)
- **Expected**: Linear scaling, no stack overflow

---

## Implementation

**File**: `packages/core/src/trace_call_graph/detect_call_graph.bench.ts`

```typescript
import { describe, bench } from 'vitest';
import { detect_call_graph } from './detect_call_graph';
import { generate_test_codebase } from './test_helpers';

describe('detect_call_graph performance', () => {
  bench('small codebase (10 functions)', () => {
    const { semantic_indexes, definitions, resolutions } =
      generate_test_codebase({ functions: 10, calls: 20 });

    detect_call_graph(semantic_indexes, definitions, resolutions);
  });

  bench('medium codebase (100 functions)', () => {
    const { semantic_indexes, definitions, resolutions } =
      generate_test_codebase({ functions: 100, calls: 200 });

    detect_call_graph(semantic_indexes, definitions, resolutions);
  });

  bench('large codebase (1000 functions)', () => {
    const { semantic_indexes, definitions, resolutions } =
      generate_test_codebase({ functions: 1000, calls: 2000 });

    detect_call_graph(semantic_indexes, definitions, resolutions);
  });

  bench('deep call chain (100 levels)', () => {
    const { semantic_indexes, definitions, resolutions } =
      generate_deep_call_chain(100);

    detect_call_graph(semantic_indexes, definitions, resolutions);
  });
});
```

---

## Optimization Targets

### If build_function_nodes is slow:

**Current approach**: Iterate all definitions, filter by type
```typescript
for (const def of definitions.get_all_definitions()) {
  if (is_callable(def.kind)) {
    // process...
  }
}
```

**Potential optimization**: Add type-based lookup to DefinitionRegistry
```typescript
// In DefinitionRegistry:
get_definitions_by_kind(kind: DefinitionKind): Definition[]

// In detect_call_graph:
const callable_defs = [
  ...definitions.get_definitions_by_kind('function'),
  ...definitions.get_definitions_by_kind('method'),
  ...definitions.get_definitions_by_kind('constructor')
];
```

**Trigger**: Only add if profiling shows it's needed (>20% of time)

---

### If scope matching is slow:

**Current approach**: For each call reference, find enclosing function
```typescript
// Already solved in 11.140.2!
// enclosing_function_scope_id computed at index time
const calls_in_function = references.filter(
  ref => ref.enclosing_function_scope_id === func.body_scope_id
);
```

**No optimization needed**: O(n) filter is acceptable

---

### If entry point detection is slow:

**Current approach**: Build set of referenced symbols, then check each function
```typescript
const called_symbols = resolutions.get_all_referenced_symbols();
for (const symbol_id of nodes.keys()) {
  if (!called_symbols.has(symbol_id)) {
    entry_points.push(symbol_id);
  }
}
```

**Potential optimization**: If `get_all_referenced_symbols()` is called multiple times, cache it
```typescript
// In ResolutionCache:
private _referenced_symbols_cache?: Set<SymbolId>;

get_all_referenced_symbols(): Set<SymbolId> {
  if (!this._referenced_symbols_cache) {
    this._referenced_symbols_cache = new Set(
      Array.from(this.resolutions.values())
        .filter(r => r.status === 'resolved')
        .map(r => r.symbol_id)
    );
  }
  return this._referenced_symbols_cache;
}
```

**Trigger**: Only add if called >2 times per call graph detection

---

## Comparison with Old Implementation

### Before (Pre-computed structures)
```typescript
// resolve_references had to:
// 1. Build references_to_symbol reverse map
// 2. Store in custom `resolved` object

// detect_call_graph had to:
// 1. Traverse scopes to find enclosing functions
// 2. Look up in references_to_symbol map
```

### After (Registry-based)
```typescript
// resolve_references:
// - Just stores resolutions in cache (no extra maps)

// detect_call_graph:
// - Direct field access (enclosing_function_scope_id, body_scope_id)
// - Simple filtering and set operations
```

**Expected improvement**: 20-40% faster, less memory

---

## Acceptance Criteria

- [ ] Benchmark suite implemented
- [ ] All scenarios run successfully
- [ ] Performance meets or exceeds old implementation
- [ ] No O(n²) algorithms identified
- [ ] Memory usage reasonable for large codebases

---

## Dependencies

**Depends on**:
- 11.140.8 (all tests passing - confirms correctness)

**Blocks**: Nothing (last step in epic 11.140)

---

## Notes

### If Performance is Worse

1. **Profile first** - Don't guess
2. **Check for regressions** in semantic_index (11.140.1, 11.140.2)
3. **Consider caching** if same data accessed multiple times
4. **Document trade-offs** if accuracy vs speed choice needed

### If Performance is Good

1. **Document results** in task notes
2. **Compare with old implementation** if data available
3. **Note any surprising findings** for future reference

---

## Success Metrics

✅ **Good outcome**: 20-40% improvement over old implementation
✅ **Acceptable outcome**: Same performance, cleaner code
❌ **Bad outcome**: >10% slower (requires investigation)
