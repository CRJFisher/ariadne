# Task Epic-11.156: Collection Dispatch Resolution

**Status**: Partially Implemented
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

## Implementation Status

### Phase 1: Infrastructure (COMPLETED)

The following infrastructure has been implemented:

#### Type System Extensions

**File**: `packages/types/src/symbol_references.ts`

```typescript
// Added to FunctionCallReference and MethodCallReference:
readonly argument_locations?: readonly Location[];

// Added to ResolutionReason union:
| { type: "collection_argument"; collection_id: SymbolId; call_site: Location }
```

#### Argument Location Extraction

**Files**: `metadata_extractors.javascript.ts`, `.python.ts`, `.rust.ts`, `.typescript.ts`

Added `extract_argument_locations()` method to all metadata extractors. Handles the tree-sitter query capture pattern where function calls capture the identifier, not the call_expression:

```typescript
extract_argument_locations(node: SyntaxNode, file_path: FilePath): Location[] | undefined {
  // Navigate from identifier to parent call_expression
  let call_node = node;
  if (node.type === "identifier" && node.parent?.type === "call_expression") {
    call_node = node.parent;
  }
  // Extract argument locations from call_expression
  // ...
}
```

#### Reference Registry Location Index

**File**: `packages/core/src/resolve_references/registries/registries.reference.ts`

Added O(1) location-based reference lookup:

```typescript
private location_to_reference: Map<string, SymbolReference> = new Map();

get_reference_at_location(location: Location): SymbolReference | null {
  const loc_key = location_key(location);
  return this.location_to_reference.get(loc_key) ?? null;
}
```

#### Collection Argument Resolution Module

**File**: `packages/core/src/resolve_references/call_resolution/call_resolution.collection_argument.ts`

Core resolver with three functions:
- `resolve_collection_arguments()` - Main entry point, iterates argument locations
- `resolve_argument_at_location()` - Resolves argument expression to symbol
- `resolve_collection_functions_recursive()` - Handles spread operators transitively

#### Pipeline Integration

**File**: `packages/core/src/resolve_references/resolve_references.ts`

Integrated into `resolve_calls()` at line ~447:

```typescript
// For function/method calls, detect collection arguments
if (ref.kind === "function_call" || ref.kind === "method_call") {
  const collection_arg_calls = resolve_collection_arguments(
    ref, definitions, this, references
  );
  resolved_calls.push(...collection_arg_calls);
}
```

### Phase 2: Testing (BLOCKED)

**Current Status**: Implementation works for direct collection passing but does NOT solve the Ariadne codebase pattern.

**Verification**: Debug logging confirmed:
- ✅ `argument_locations` are correctly extracted (count: 2 for `process_definitions` calls)
- ✅ Arguments resolve to correct symbol IDs
- ❌ `handler_registry` variable has NO `function_collection` metadata

## Discovered Limitation: Factory Function Indirection

### The Actual Pattern in Ariadne

```typescript
// In index_single_file.ts:
const handler_registry = get_handler_registry(language);  // ← INDIRECT
process_definitions(context, handler_registry);

// In capture_handlers/index.ts:
export function get_handler_registry(language: Language): HandlerRegistry {
  switch (language) {
    case "typescript": return TYPESCRIPT_HANDLERS;  // ← Actual collection
    // ...
  }
}
```

### Why It Fails

The implementation detects collections at the **call site**. When `process_definitions(context, handler_registry)` is called:

1. ✅ Argument `handler_registry` is resolved to its VariableDefinition
2. ❌ That variable has NO `function_collection` because it wasn't declared with a collection literal
3. ❌ The variable was assigned from a function call return value, not directly

The `function_collection` metadata only exists on `TYPESCRIPT_HANDLERS`, `JAVASCRIPT_HANDLERS`, etc. - not on `handler_registry`.

### The Core Issue: Value Flow vs Type Flow

**What we track**: Types (via TypeRegistry)
**What we need**: Values (which specific collection instance is assigned)

```
TYPESCRIPT_HANDLERS (has function_collection)
        │
        ▼
get_handler_registry("typescript")
        │
        ▼ (return value - VALUE FLOW LOST)
        │
handler_registry (type: HandlerRegistry, NO function_collection)
        │
        ▼
process_definitions(context, handler_registry)
        │
        ▼
Resolution: handler_registry → VariableDefinition → NO COLLECTION
```

## Alternative Approaches Analysis

### Approach A: Current Implementation (Argument-Based Detection)

**What it handles**:
- `dispatch(HANDLERS)` - Direct collection passing ✅
- `dispatch({...BASE, new: fn})` - Inline spread ✅
- `EXTENDED = {...BASE}; dispatch(EXTENDED)` - Transitive spread ✅

**What it cannot handle**:
- `const x = get_registry(); dispatch(x)` - Function return ❌
- `const x = factory.create(); dispatch(x)` - Method return ❌

**Effort**: COMPLETE (~239 lines)

### Approach B: Return Type Flow Tracking

**Concept**: Track that `handler_registry` was assigned from `get_handler_registry()`, then resolve what that function returns.

**Why it's insufficient**: Knowing the return TYPE (`HandlerRegistry`) doesn't tell us the return VALUE. The function returns different collections based on the `language` parameter. We'd need:
1. Inter-procedural control flow analysis
2. Constant propagation for the `language` argument
3. Branch analysis within `get_handler_registry()`

**Effort**: HIGH (inter-procedural analysis)

### Approach C: Return Value Collection Propagation

**Concept**: For functions that ONLY return known collections, propagate that information.

```typescript
// Detect: get_handler_registry() returns one of [TYPESCRIPT_HANDLERS, JAVASCRIPT_HANDLERS, ...]
// Mark: handler_registry inherits union of all possible collections
```

**Implementation**:
1. Analyze function bodies for return statements
2. If ALL returns are known collections, mark function as "collection factory"
3. Variables assigned from collection factories inherit combined function_collection

**Pros**:
- Works for the actual Ariadne pattern
- No inter-procedural value tracking needed
- Conservative (union of all possibilities)

**Cons**:
- Over-approximates (marks handlers called even if that branch isn't taken)
- Requires function body analysis
- May not work for external libraries

**Effort**: MEDIUM (~200-300 lines)

### Approach D: Refactor Ariadne's Code

**Concept**: Change Ariadne to use the direct pattern that our implementation handles.

**Option 1**: Inline the function call
```typescript
// Instead of:
const handler_registry = get_handler_registry(language);
process_definitions(context, handler_registry);

// Use:
process_definitions(context, get_handler_registry(language));
```
This still doesn't work because the return value isn't a collection variable.

**Option 2**: Pass handlers directly per language
```typescript
// Switch-based dispatch at call site
switch (language) {
  case "typescript":
    process_definitions(context, TYPESCRIPT_HANDLERS);
    break;
  // ...
}
```

**Pros**: Zero additional analysis complexity
**Cons**: Code duplication, diverges from current architecture

**Effort**: LOW (~20 lines changed)

## Recommendations

### Short-Term (Pragmatic)

**Option 1: Accept Limitation + Document**
- Current implementation works for direct patterns
- Document that factory function indirection isn't supported
- Entry point analysis will include handler functions (known limitation)

**Option 2: Refactor Ariadne's Code**
- Change `index_single_file.ts` to pass handlers directly
- Most targeted fix with zero analysis complexity

### Medium-Term (Approach C)

Implement return value collection propagation:

1. **Detect collection factory functions**:
   - Analyze function return statements
   - If ALL returns are identifiers that resolve to collections, mark as factory

2. **Propagate to assigned variables**:
   - When `const x = factory()`, check if factory is collection factory
   - If yes, create synthetic function_collection with union of all possible returns

3. **Files to modify**:
   - `resolve_references.ts` - Add factory detection pass
   - `registries.definition.ts` - Add collection factory tracking
   - `call_resolution.collection_argument.ts` - Check for factory-derived collections

### Long-Term (Not Recommended)

Full inter-procedural value flow analysis would require:
- Control flow graphs for function bodies
- Constant propagation
- Context-sensitive analysis (different call sites → different results)

This is significantly beyond the current scope and would be a major architectural addition.

## Files Modified (Current Implementation)

| File | Changes |
|------|---------|
| `packages/types/src/symbol_references.ts` | +5 lines: argument_locations, collection_argument reason |
| `packages/core/src/.../metadata_extractors.javascript.ts` | +37 lines: extract_argument_locations |
| `packages/core/src/.../metadata_extractors.python.ts` | +39 lines: extract_argument_locations |
| `packages/core/src/.../metadata_extractors.rust.ts` | +37 lines: extract_argument_locations |
| `packages/core/src/.../metadata_extractors.types.ts` | +9 lines: interface addition |
| `packages/core/src/.../metadata_extractors.typescript.ts` | +1 line: delegate to JS |
| `packages/core/src/.../references.factories.ts` | +8 lines: argument_locations param |
| `packages/core/src/.../references.ts` | +24 lines: extract and pass argument_locations |
| `packages/core/src/.../call_resolution/index.ts` | +1 line: export |
| `packages/core/src/.../call_resolution/call_resolution.collection_argument.ts` | +214 lines: NEW FILE |
| `packages/core/src/.../registries/registries.reference.ts` | +54 lines: location index |
| `packages/core/src/.../resolve_references.ts` | +23 lines: integration |

**Total**: ~239 lines added across 12 files

## Success Criteria (Updated)

### For Direct Pattern (COMPLETE)
- [x] Argument locations extracted for all call expressions
- [x] Location-based reference lookup (O(1))
- [x] Collection argument detection and resolution
- [x] Transitive spread operator handling
- [x] Integration into call resolution pipeline

### For Factory Pattern (NOT STARTED)
- [ ] Collection factory function detection
- [ ] Return value collection propagation
- [ ] Handler functions no longer appear as entry points
- [ ] Entry point count returns to ~124

## Related Work

- **Spread detection** (completed): `symbol_factories.*.ts` capture spread in `stored_references`
- **Indirect invocation** (completed): `derived_from` tracks `config.get(type)` patterns
- **Type registry** (exists): Tracks explicit type annotations and constructor types
