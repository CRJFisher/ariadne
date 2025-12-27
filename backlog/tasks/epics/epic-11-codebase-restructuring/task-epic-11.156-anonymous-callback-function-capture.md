# Task Epic-11.156: Collection Dispatch Resolution

**Status**: In Progress
**Priority**: P0 (High Impact)
**Epic**: epic-11-codebase-restructuring
**Impact**: Fixes 92+ false positive entry points from handler registry patterns

## Problem

Handler functions in registry patterns appear as uncalled entry points despite being registered and dispatched dynamically. This affects all `capture_handlers.<language>.ts` files.

### The Pattern

```typescript
// 1. Handler registry with named functions
export const TYPESCRIPT_HANDLERS: HandlerRegistry = {
  ...JAVASCRIPT_HANDLERS,
  "definition.class": handle_definition_class,
  "definition.method": handle_definition_method,
};

// 2. Registry passed to dispatch function
process_captures(captures, TYPESCRIPT_HANDLERS);

// 3. Dispatch function retrieves and calls handlers
function process_captures(captures: Capture[], registry: HandlerRegistry) {
  for (const capture of captures) {
    const handler = registry[capture.name];
    if (handler) handler(capture);
  }
}
```

**Result**: `handle_definition_class`, `handle_definition_method`, etc. appear as entry points because the call graph cannot trace through the parameter-based dispatch.

### Scale of Impact

| File | Affected Handlers |
|------|-------------------|
| `capture_handlers.typescript.ts` | 30+ |
| `capture_handlers.javascript.ts` | 30+ |
| `capture_handlers.python.ts` | 15+ |
| `capture_handlers.rust.ts` | 15+ |

**Total**: 92+ functions incorrectly flagged as entry points

## Root Cause

### Two-Layer Problem

**Layer 1: Spread operator detection** (FIXED - December 2024)

Collection extraction functions now capture spread/splat operators:
- `{...OTHER_HANDLERS}` captured in `stored_references`
- `[*other_list]` captured in `stored_references`

**Layer 2: Parameter-based dispatch** (this task)

When a collection is passed as a function argument, the resolution chain breaks:

```
TYPESCRIPT_HANDLERS (collection with stored_references)
      │
      ▼
process_captures(captures, TYPESCRIPT_HANDLERS)  ← Collection info lost here
      │
      ▼
registry (parameter)                              ← Just a name, no metadata
      │
      ▼
handler = registry[key]
      │
      ▼
Resolution: "registry" → parameter               ← No function_collection!
      │
      ▼
DEAD END - handlers appear uncalled
```

**Why parameters don't work**:
1. Parameters are typed names, not value references
2. No tracking of which argument was passed at each call site
3. No propagation of collection metadata through call boundaries

## Solution: Argument-Based Collection Consumption

### Core Heuristic

**Passing a function collection as an argument implies consuming (calling) its contents.**

When we detect a call expression where an argument resolves to a function collection, we mark all functions in that collection as "called" at that call site.

### Why This Works

1. **Semantic truth**: Passing a handler registry to a function indicates intent to dispatch from it
2. **No parameter tracking needed**: Detection happens at the call site where the actual collection variable is visible
3. **Transitive resolution**: If `TYPESCRIPT_HANDLERS` contains `"JAVASCRIPT_HANDLERS"` in `stored_references`, we resolve recursively
4. **Language-agnostic**: Same pattern works across TypeScript, JavaScript, Python, Rust

### Call Reference Model

For: `process_captures(captures, TYPESCRIPT_HANDLERS)`

We create call references:
```typescript
{
  caller: "<containing_function>",
  callee: "handle_definition_class",
  location: { line: 42, column: 0 },  // The process_captures call site
  via: "TYPESCRIPT_HANDLERS"           // Indicates collection-mediated dispatch
}
```

The `via` field distinguishes direct calls from collection-mediated dispatch.

## Implementation

### Phase 1: Detect Collection Arguments in Call Expressions

Location: `packages/core/src/resolve_references/call_resolution/`

```typescript
function process_call_expression(
  call_node: SyntaxNode,
  context: ResolutionContext
): void {
  // Existing: resolve the function being called
  resolve_call_target(call_node, context);

  // NEW: check arguments for function collections
  const args_node = call_node.childForFieldName("arguments");
  if (args_node) {
    process_collection_arguments(args_node, call_node, context);
  }
}

function process_collection_arguments(
  args_node: SyntaxNode,
  call_node: SyntaxNode,
  context: ResolutionContext
): void {
  for (const arg of args_node.namedChildren) {
    if (arg.type === "identifier") {
      const definition = resolve_symbol(arg.text, context);

      if (definition?.function_collection) {
        // Mark all stored references as called via this collection
        mark_collection_contents_as_called(
          definition.function_collection,
          definition.name,  // via field
          call_node,        // location source
          context
        );
      }
    }
  }
}
```

### Phase 2: Recursive Collection Resolution

```typescript
function mark_collection_contents_as_called(
  collection: FunctionCollection,
  via: SymbolName,
  call_node: SyntaxNode,
  context: ResolutionContext
): void {
  for (const ref_name of collection.stored_references) {
    const ref_definition = resolve_symbol(ref_name, context);

    if (ref_definition?.kind === "function") {
      // Direct function reference - mark as called
      add_call_reference({
        caller: context.current_scope_id,
        callee: ref_definition.symbol_id,
        location: extract_location(call_node),
        via: via,
      });
    } else if (ref_definition?.function_collection) {
      // Nested collection (e.g., spread) - resolve recursively
      mark_collection_contents_as_called(
        ref_definition.function_collection,
        via,
        call_node,
        context
      );
    }
  }
}
```

### Phase 3: Update Call Reference Type

Location: `packages/types/src/`

```typescript
interface CallReference {
  caller: SymbolId;
  callee: SymbolId;
  location: CodeLocation;
  via?: SymbolName;  // NEW: indicates collection-mediated dispatch
}
```

## Testing

### Unit Tests

```typescript
describe("Collection Dispatch Resolution", () => {
  test("marks collection contents as called when passed as argument", () => {
    const code = `
      const HANDLERS = { key: myHandler };
      function myHandler() {}
      function dispatch(registry) { registry.key(); }
      dispatch(HANDLERS);
    `;

    const graph = build_call_graph(code, "test.ts");

    // myHandler should NOT be an entry point
    const entry_points = get_entry_points(graph);
    expect(entry_points).not.toContain("myHandler");

    // myHandler should have a caller
    const myHandler_node = graph.nodes.get("myHandler");
    expect(myHandler_node.callers.size).toBeGreaterThan(0);
  });

  test("resolves spread references transitively", () => {
    const code = `
      const BASE = { a: handlerA };
      const EXTENDED = { ...BASE, b: handlerB };
      function handlerA() {}
      function handlerB() {}
      function dispatch(registry) {}
      dispatch(EXTENDED);
    `;

    const graph = build_call_graph(code, "test.ts");

    // Both handlers should be marked as called
    expect(get_entry_points(graph)).not.toContain("handlerA");
    expect(get_entry_points(graph)).not.toContain("handlerB");
  });

  test("includes via field for collection-mediated calls", () => {
    const code = `
      const HANDLERS = { key: myHandler };
      function myHandler() {}
      dispatch(HANDLERS);
    `;

    const references = get_call_references(code, "test.ts");
    const handler_ref = references.find(r => r.callee === "myHandler");

    expect(handler_ref).toBeDefined();
    expect(handler_ref.via).toBe("HANDLERS");
  });
});
```

### Integration Test

```typescript
test("capture_handlers functions are not entry points", () => {
  const analysis = run_top_level_nodes_analysis();

  const capture_handler_entries = analysis.entry_points.filter(
    ep => ep.file_path.includes("capture_handlers")
  );

  // Should be zero or minimal
  expect(capture_handler_entries.length).toBeLessThan(5);
});
```

## Success Criteria

- [ ] Handler functions in `capture_handlers.*.ts` no longer appear as entry points
- [ ] Entry point count returns to ~124 (from current 216)
- [ ] Call references include `via` field for collection-mediated dispatch
- [ ] Spread/splat operators resolve transitively
- [ ] No performance regression (< 5% overhead)
- [ ] Works across TypeScript, JavaScript, Python, Rust

## Verification

1. Run `npm run generate-fixtures` after implementation
2. Run top-level-nodes analysis
3. Compare entry point counts: before (216) vs after (target: ~124)
4. Verify no `capture_handlers` functions in entry points list

## Edge Cases

### Handled

| Pattern | Resolution |
|---------|------------|
| `dispatch(HANDLERS)` | Direct collection argument |
| `dispatch({...BASE, key: fn})` | Inline spread at call site |
| `EXTENDED = {...BASE}; dispatch(EXTENDED)` | Transitive through spread |
| Multiple collection args | Each processed independently |

### Not Handled (acceptable)

| Pattern | Why Acceptable |
|---------|---------------|
| `outer(HANDLERS)` → `inner(x)` → `use(x)` | Multi-layer parameter passing is rare |
| `const x = HANDLERS; dispatch(x)` | Variable aliasing - could add later if needed |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/resolve_references/call_resolution/*.ts` | Add collection argument processing |
| `packages/types/src/call_reference.ts` | Add `via` field |
| `packages/core/src/resolve_references/call_resolution/*.test.ts` | Add tests |

## Related Work

- **Spread detection** (completed): `symbol_factories.*.ts` now capture spread/splat in `stored_references`
- **Test coverage** (completed): `symbol_factories.collection.test.ts` covers spread patterns
