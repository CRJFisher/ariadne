# Sub-Task 11.140.6: Refactor detect_entry_points Implementation

**Parent Task**: task-epic-11.140
**Status**: Not Started
**Priority**: High
**Estimated Effort**: 1 hour

---

## Goal

Rewrite `detect_entry_points` to use ResolutionCache directly. Entry points are functions NOT in the set of referenced symbols.

---

## Implementation

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

### New detect_entry_points

```typescript
/**
 * Detect entry points in the call graph.
 * Entry points are functions that are never called by any other function.
 * 
 * Algorithm:
 * 1. Get set of all SymbolIds that are referenced (called)
 * 2. Find function nodes whose SymbolId is NOT in that set
 * 
 * @param nodes - All function nodes in the call graph
 * @param resolutions - Resolution cache (to find what's called)
 * @returns Array of SymbolIds that are entry points
 */
function detect_entry_points(
  nodes: Map<SymbolId, FunctionNode>,
  resolutions: ResolutionCache
): SymbolId[] {
  // Get all SymbolIds that are referenced (called)
  const called_symbols = resolutions.get_all_referenced_symbols();
  
  // Entry points are functions NOT in the called set
  const entry_points: SymbolId[] = [];
  
  for (const symbol_id of nodes.keys()) {
    if (!called_symbols.has(symbol_id)) {
      entry_points.push(symbol_id);
    }
  }
  
  return entry_points;
}
```

---

## Key Simplifications

### Before (Complex)
```typescript
// Had to:
// 1. Use pre-computed reverse map (references_to_symbol)
// 2. Check if symbol appears as target of any reference

for (const id of nodes.keys()) {
  if (!resolved.references_to_symbol.has(id)) {
    entry_points.push(id);
  }
}
```

### After (Simple)
```typescript
// ResolutionCache directly tells us what's referenced
const called_symbols = resolutions.get_all_referenced_symbols();

for (const symbol_id of nodes.keys()) {
  if (!called_symbols.has(symbol_id)) {
    entry_points.push(symbol_id);
  }
}
```

**Why it works**: ResolutionCache already has all the data (reference → target), we just need to extract the targets.

---

## Edge Cases

### 1. Recursive Functions
- Function calls itself
- Will appear in `called_symbols`
- NOT an entry point (correct!)

### 2. Mutual Recursion
- Function A calls B, B calls A
- Both appear in `called_symbols`
- Neither is entry point (correct!)

### 3. All Functions Called
- Every function called by another
- `entry_points` = empty array (valid scenario)

### 4. No Functions Called
- No resolutions (empty project or all top-level calls)
- All functions are entry points (correct!)

---

## Testing Strategy

### Manual Walkthrough

```typescript
// Example code:
function main() {
  helper();
}
function helper() {
  return 42;
}

// After resolution:
// Reference "helper" at line 2 → resolves to helper's SymbolId

// ResolutionCache contains:
// Map { ref_to_helper → helper_symbol_id }

// get_all_referenced_symbols():
// Set { helper_symbol_id }

// detect_entry_points:
// main_symbol_id NOT in called_symbols → entry point
// helper_symbol_id IN called_symbols → not entry point
// Result: [main_symbol_id]
```

Verify logic is correct.

---

## Update Main Function

**File**: `packages/core/src/trace_call_graph/detect_call_graph.ts`

Update the main function to call both helpers:

```typescript
export function detect_call_graph(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  resolutions: ResolutionCache
): CallGraph {
  // Build function nodes with their enclosed calls
  const nodes = build_function_nodes(semantic_indexes, definitions);
  
  // Detect entry points (functions never called)
  const entry_points = detect_entry_points(nodes, resolutions);
  
  return {
    nodes,
    entry_points
  };
}
```

---

## Acceptance Criteria

- [ ] Function implemented using ResolutionCache
- [ ] Logic walkthrough confirms correctness
- [ ] Main detect_call_graph function updated
- [ ] Code compiles
- [ ] Ready for testing in 11.140.9

---

## Dependencies

**Depends on**:
- 11.140.3 (needs get_all_referenced_symbols)
- 11.140.4 (needs new signature)
- 11.140.5 (needs build_function_nodes to create nodes map)

**Blocks**: 11.140.7 (Project integration)
