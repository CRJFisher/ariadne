# Task Epic-11.156: Function Collection Reachability

**Status**: TODO
**Priority**: P0 (High Impact)
**Epic**: epic-11-codebase-restructuring
**Impact**: Fixes 92+ false positive entry points from handler registry patterns

## Problem

Handler functions in registry patterns appear as uncalled entry points despite being registered and dispatched dynamically. This affects all `capture_handlers.<language>.ts` files.

### The Pattern

```typescript
// Handler registry with named functions
export const TYPESCRIPT_HANDLERS: HandlerRegistry = {
  ...JAVASCRIPT_HANDLERS,
  "definition.class": handle_definition_class,
  "definition.method": handle_definition_method,
};

// Factory function returns the collection
export function get_handler_registry(language: Language): HandlerRegistry {
  switch (language) {
    case "typescript": return TYPESCRIPT_HANDLERS;
    case "javascript": return JAVASCRIPT_HANDLERS;
    // ...
  }
}
```

**Result**: `handle_definition_class`, `handle_definition_method`, etc. appear as entry points.

### Scale of Impact

| File | Affected Handlers |
| ---- | ----------------- |
| `capture_handlers.typescript.ts` | 30+ |
| `capture_handlers.javascript.ts` | 30+ |
| `capture_handlers.python.ts` | 15+ |
| `capture_handlers.rust.ts` | 15+ |

**Total**: 92+ functions incorrectly flagged as entry points

## Solution: Read-Based Collection Consumption

### Core Heuristic

**If a function collection variable is read, its stored functions are considered reachable.**

This triggers on any read of the collection:

- `return COLLECTION` - collection is read (covers factory pattern)
- `dispatch(COLLECTION)` - collection is read (argument is a read)
- `const x = COLLECTION[key]` - collection is read
- `some_function(COLLECTION)` - collection is read

### Why This Works

1. **Handles factory pattern**: `return TYPESCRIPT_HANDLERS` is a read of the collection
2. **No false call attribution**: We don't create misleading call edges
3. **Simple implementation**: ~30-50 lines vs previous 239 lines
4. **Language-agnostic**: Same pattern works across all languages

### Key Insight: Reachability vs Call Edges

We distinguish two orthogonal concerns:

| Concern | Key | Purpose |
| ------- | --- | ------- |
| **Reachability** | `SymbolId` | Is this function called somewhere? (entry point detection) |
| **Call edges** | `CallReference` | WHO calls this function? (call graph visualization) |

For handler registries, we care about **reachability** - ensuring handlers aren't marked as entry points. We don't need accurate call edges for dynamically dispatched patterns.

## Data Model

### IndirectReachability Type

```typescript
// packages/types/src/call_chains.ts

/**
 * Reasons why a function is reachable without a direct call edge
 */
export type IndirectReachabilityReason =
  | { type: "collection_read"; collection_id: SymbolId; read_location: Location };
  // Note: callback_external already handled via is_callback_invocation

/**
 * Function reachability without direct call edge
 */
export interface IndirectReachability {
  readonly function_id: SymbolId;
  readonly reason: IndirectReachabilityReason;
}
```

### Extended CallGraph

```typescript
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, CallableNode>;
  readonly entry_points: readonly SymbolId[];

  /** Functions reachable through indirect mechanisms (not via call edges) */
  readonly indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>;
}
```

### Extended ResolutionRegistry

```typescript
class ResolutionRegistry {
  // Existing
  private resolved_calls_by_file: Map<FilePath, CallReference[]>;

  // NEW: Track indirect reachability separately
  private indirect_reachability: Map<SymbolId, IndirectReachability> = new Map();

  add_indirect_reachability(fn_id: SymbolId, reason: IndirectReachabilityReason): void {
    this.indirect_reachability.set(fn_id, { function_id: fn_id, reason });
  }

  get_all_referenced_symbols(): Set<SymbolId> {
    const direct = /* existing: collect from call resolutions */;
    // Include indirectly reachable functions
    return new Set([...direct, ...this.indirect_reachability.keys()]);
  }

  get_indirect_reachability(): ReadonlyMap<SymbolId, IndirectReachability> {
    return this.indirect_reachability;
  }
}
```

## Implementation

### Phase 1: Detect Collection Variable Reads

During reference processing, detect when a function collection is read:

```typescript
// In resolve_references.ts or dedicated module

function process_variable_references(
  references: SymbolReference[],
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): void {
  for (const ref of references) {
    // Only process variable reads (not writes, not calls)
    if (ref.kind !== "variable_reference") continue;

    // Resolve the referenced symbol
    const definition = resolve_symbol(ref.name, ref.scope_id);
    if (!definition) continue;

    // Check if it has function_collection metadata
    if (definition.function_collection) {
      mark_collection_as_consumed(
        definition,
        ref.location,
        definitions,
        resolutions
      );
    }
  }
}
```

### Phase 2: Mark Collection Contents as Reachable

```typescript
function mark_collection_as_consumed(
  collection_def: VariableDefinition,
  read_location: Location,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  visited: Set<SymbolId> = new Set()
): void {
  // Prevent infinite recursion on circular references
  if (visited.has(collection_def.symbol_id)) return;
  visited.add(collection_def.symbol_id);

  const collection = collection_def.function_collection!;

  for (const ref_name of collection.stored_references) {
    const ref_def = definitions.get_by_name(ref_name);
    if (!ref_def) continue;

    if (ref_def.kind === "function") {
      // Direct function reference - mark as reachable
      resolutions.add_indirect_reachability(ref_def.symbol_id, {
        type: "collection_read",
        collection_id: collection_def.symbol_id,
        read_location,
      });
    } else if (ref_def.function_collection) {
      // Nested collection (spread) - resolve recursively
      mark_collection_as_consumed(
        ref_def,
        read_location,
        definitions,
        resolutions,
        visited
      );
    }
  }
}
```

### Phase 3: Include in CallGraph Output

```typescript
// In trace_call_graph.ts

export function detect_call_graph(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): CallGraph {
  const nodes = build_function_nodes(definitions, resolutions);
  const entry_points = detect_entry_points(nodes, resolutions);

  return {
    nodes,
    entry_points,
    // Include indirect reachability for downstream tools
    indirect_reachability: resolutions.get_indirect_reachability(),
  };
}
```

## Existing Infrastructure (Keep)

### Spread Detection (d0a26d79)

The spread operator detection is **required** for transitive resolution:

```typescript
const TYPESCRIPT_HANDLERS = { ...JAVASCRIPT_HANDLERS, foo: handler_foo };
// stored_references: ["JAVASCRIPT_HANDLERS", "handler_foo"]
```

When we detect a read of `TYPESCRIPT_HANDLERS`, we recursively resolve `JAVASCRIPT_HANDLERS` to get all handlers.

**Files with spread detection**:

- `symbol_factories.javascript.ts` - `extract_functions_from_object`, `extract_functions_from_array`
- `symbol_factories.python.ts` - `extract_functions_from_dict`, `extract_functions_from_list`
- `symbol_factories.collection.test.ts` - Test coverage

## Success Criteria

- [ ] Handler functions in `capture_handlers.*.ts` no longer appear as entry points
- [ ] Entry point count returns to ~124 (from current 216)
- [ ] `indirect_reachability` map available on CallGraph for downstream tools
- [ ] Spread operators resolve transitively
- [ ] No performance regression (< 5% overhead)
- [ ] Works across TypeScript, JavaScript, Python, Rust

## Files to Modify

| File | Changes |
| ---- | ------- |
| `packages/types/src/call_chains.ts` | Add IndirectReachability types |
| `packages/core/src/resolve_references/resolve_references.ts` | Add collection read detection |
| `packages/core/src/trace_call_graph/trace_call_graph.ts` | Include indirect_reachability |
| `packages/core/src/resolve_references/*.test.ts` | Add tests |

## Verification

1. Run top-level-nodes analysis before implementation
2. Note current entry point count (expected: ~216)
3. Implement changes
4. Run analysis again
5. Verify entry point count drops to ~124
6. Verify no `capture_handlers` functions in entry points

## Edge Cases

### Handled

| Pattern | Mechanism |
| ------- | --------- |
| `return HANDLERS` | Collection is read in return statement |
| `dispatch(HANDLERS)` | Collection is read as argument |
| `const x = HANDLERS[k]` | Collection is read in subscript |
| `{ ...HANDLERS }` | Collection is read in spread |
| Transitive spreads | Recursive resolution via stored_references |

### Not Handled (Acceptable)

| Pattern | Why Acceptable |
| ------- | -------------- |
| External library collections | Can't analyze external code |
| Dynamic collection construction | `const h = {}; h[key] = fn;` - rare pattern |

## Related Work

- **task-109**: Call site metadata (orthogonal - call-site-level context)
- **Callback external**: Already handled via `is_callback_invocation`
- **Spread detection**: Completed in d0a26d79
