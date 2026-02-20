# Task: Migrate detect_call_graph to Registry-Native Architecture

**Parent Task**: epic-11 - Codebase Restructuring
**Status**: Not Started
**Priority**: High
**Complexity**: Medium-High
**Approach**: Analysis-Led Iterative Negotiation

---

## Executive Summary

Complete the integration of `detect_call_graph()` with the Project coordination layer by refactoring it to work **directly with registries** instead of the legacy `ResolvedSymbols` structure. This requires a **client-driven negotiation** between what `detect_call_graph` needs and what APIs the registries should expose.

**No adapter pattern.** No intermediate data structures. Direct registry queries.

---

## Deep Analysis: What detect_call_graph Really Needs

### Current Implementation Analysis

[detect_call_graph.ts:13-75](packages/core/src/trace_call_graph/detect_call_graph.ts#L13-L75) does two things:

**1. Build function nodes with enclosed calls:**

```typescript
// Groups CallReferences by which function they're inside
for (const reference of resolved.references) {
  const ref_location_key = location_key(reference.location);
  const resolved_symbol_id = resolved.resolved_references.get(ref_location_key);
  // ^^^ CRITICAL: This maps reference location → ENCLOSING function's SymbolId
  //     NOT what the reference points to!

  symbol_to_enclosed_calls.set(resolved_symbol_id, enclosed_calls);
}
```

**2. Detect entry points (never-called functions):**

```typescript
// Checks if a function SymbolId appears in references_to_symbol
for (const id of nodes.keys()) {
  if (!resolved.references_to_symbol.has(id)) {
    entry_points.push(id); // Never called
  }
}
```

### The Core Requirements

To build a call graph, `detect_call_graph` needs to answer:

1. **"What are all the functions in the codebase?"**
   → Query: Get all definitions with kind = function/method/constructor

2. **"For each function, what calls does it make?"**
   → Query: Given a function/method/constructor def, find all CallReferences inside its scope

3. **"Which functions are never called?"**
   → Query: Get set of all SymbolIds that are referenced, check which functions aren't in it

### The Data Gap

**What registries currently provide:**

- DefinitionRegistry: Get definitions by file
- ResolutionCache: Maps `ReferenceId → SymbolId` (what the reference POINTS TO)
- ScopeRegistry: Scope trees, scope lookups, scope chains
- SemanticIndex: All references including CallReferences

**What's missing:**

- ✗ Map reference location → enclosing function
- ✗ Given function def, find its scope
- ✗ Check if scope A is within scope B
- ✗ Get all referenced SymbolIds (reverse lookup)

---

## Registry API Negotiation

### Key Insight: CallReference Already Has scope_id

```typescript
interface CallReference {
  readonly scope_id: ScopeId; // ← The scope where the call occurs!
  // ...
}
```

We can traverse from a reference's scope up to its enclosing function scope!

### Key Insight: Scopes Have Types

```typescript
interface LexicalScope {
  readonly type: ScopeType; // "function" | "method" | "constructor" | ...
  readonly name: SymbolName | null;
  readonly location: Location;
  readonly parent_id: ScopeId | null;
  // ...
}
```

We can identify function scopes by type and match them to definitions!

### Proposed Registry Extensions

#### 1. ScopeRegistry: Scope-to-Function Matching

```typescript
/**
 * Find the function/method/constructor scope corresponding to a definition.
 * Matches by name, type, and location proximity.
 *
 * @param func_def - The function definition
 * @returns The scope representing that function's body, or undefined
 */
find_function_scope_for_definition(func_def: FunctionDefinition): LexicalScope | undefined
```

**Purpose**: Link a function definition to its body scope.

**Implementation strategy**:

- Search scopes in the definition's file
- Filter to scopes with type "function"/"method"/"constructor"
- Match by name and location (scope location should contain definition location)

#### 2. ScopeRegistry: Scope Containment Check

```typescript
/**
 * Check if one scope is within another scope's hierarchy.
 * Stops at function boundaries - does not traverse INTO nested functions.
 *
 * @param inner_scope_id - The scope to test
 * @param outer_scope_id - The potential containing scope
 * @returns True if inner is within outer (not crossing function boundaries)
 */
is_scope_within(inner_scope_id: ScopeId, outer_scope_id: ScopeId): boolean
```

**Purpose**: Determine if a CallReference is inside a specific function.

**Implementation strategy**:

- Start from inner_scope_id, traverse up via parent_id
- If we reach outer_scope_id, return true
- If we hit a function/method/constructor scope (other than outer), return false (boundary)
- If we reach root without finding outer, return false

#### 3. ResolutionCache: Reverse Lookup

```typescript
/**
 * Get all SymbolIds that are referenced anywhere in the codebase.
 * Used for entry point detection (functions not in this set are entry points).
 *
 * @returns Set of all SymbolIds that appear as resolution targets
 */
get_all_referenced_symbols(): Set<SymbolId>
```

**Purpose**: Detect which functions are called vs never called.

**Implementation strategy**:

- Iterate all resolutions in the cache
- Collect unique SymbolIds from resolution values
- Return as Set for O(1) lookup

---

## High-Level Migration Steps

### Phase 1: Extend Registry APIs (Foundational)

**Goal**: Add the three methods identified above to registries.

**Steps**:

1. Implement `ScopeRegistry.find_function_scope_for_definition()`

   - Add helper: `find_matching_scope_recursive()` to search scope tree
   - Match by: type, name, and location proximity
   - Handle edge cases: anonymous functions, constructors, methods

2. Implement `ScopeRegistry.is_scope_within()`

   - Traverse parent chain from inner to outer
   - Stop at function boundaries (don't cross into nested functions)
   - Cache results? (optional optimization)

3. Implement `ResolutionCache.get_all_referenced_symbols()`
   - Iterate `resolutions` map, collect values
   - Return as Set

**Validation**: Write unit tests for each new method in isolation.

---

### Phase 2: Refactor detect_call_graph Signature (Breaking Change)

**Goal**: Change function signature to accept registries instead of ResolvedSymbols.

**Current**:

```typescript
export function detect_call_graph(resolved: ResolvedSymbols): CallGraph;
```

**New**:

```typescript
export function detect_call_graph(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  resolutions: ResolutionCache
): CallGraph;
```

**Steps**:

1. Update function signature in `detect_call_graph.ts`
2. Update imports
3. Keep tests commented out (we'll fix them in Phase 4)

**Validation**: Code compiles (tests will fail - that's expected).

---

### Phase 3: Refactor build_function_nodes (Core Logic)

**Goal**: Rewrite to use registries directly.

**New implementation**:

```typescript
function build_function_nodes(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry
): Map<SymbolId, FunctionNode> {
  const nodes = new Map<SymbolId, FunctionNode>();

  // Iterate through all files
  for (const [file_path, index] of semantic_indexes) {
    const file_definitions = definitions.get_file_definitions(file_path);

    // Process each function/method/constructor definition
    for (const def of file_definitions) {
      if (!is_function_like(def)) continue; // Helper: check kind

      // Find the function's scope
      const func_scope = scopes.find_function_scope_for_definition(def);
      if (!func_scope) {
        // Warning: couldn't find scope for function (defensive)
        nodes.set(def.symbol_id, {
          symbol_id: def.symbol_id,
          name: def.name,
          enclosed_calls: [],
          location: def.location,
          definition: def,
        });
        continue;
      }

      // Find all CallReferences inside this function's scope
      const enclosed_calls = find_calls_in_scope(
        index.references,
        func_scope,
        scopes
      );

      nodes.set(def.symbol_id, {
        symbol_id: def.symbol_id,
        name: def.name,
        enclosed_calls,
        location: def.location,
        definition: def,
      });
    }
  }

  return nodes;
}

// Helper: Check if definition is function-like
function is_function_like(def: AnyDefinition): boolean {
  return (
    def.kind === "function" ||
    def.kind === "method" ||
    def.kind === "constructor"
  );
}

// Helper: Find calls within a specific function scope
function find_calls_in_scope(
  all_references: readonly Reference[],
  func_scope: LexicalScope,
  scopes: ScopeRegistry
): CallReference[] {
  const enclosed_calls: CallReference[] = [];

  for (const ref of all_references) {
    // Filter to CallReferences only
    if (!("call_type" in ref)) continue;

    // Check if reference is within this function's scope
    if (scopes.is_scope_within(ref.scope_id, func_scope.id)) {
      enclosed_calls.push(ref as CallReference);
    }
  }

  return enclosed_calls;
}
```

**Steps**:

1. Add helper `is_function_like()`
2. Add helper `find_calls_in_scope()`
3. Rewrite `build_function_nodes()` body
4. Remove old code that used `ResolvedSymbols`

**Validation**: Code compiles. Logic walkthrough with example.

---

### Phase 4: Refactor detect_entry_points (Simpler)

**Goal**: Use ResolutionCache directly.

**New implementation**:

```typescript
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

**Steps**:

1. Rewrite function body to use `resolutions.get_all_referenced_symbols()`
2. Remove old code that used `resolved.references_to_symbol`

**Validation**: Code compiles. Logic walkthrough with example.

---

### Phase 5: Update Project.get_call_graph() (Integration)

**Goal**: Call detect_call_graph with registries.

**Current** ([project.ts:348](packages/core/src/project/project.ts#L348)):

```typescript
get_call_graph(): CallGraph {
  if (this.call_graph_cache) {
    return this.call_graph_cache;
  }

  this.resolve_all_pending();

  // TODO: placeholder, returns empty graph
  this.call_graph_cache = { nodes: new Map(), entry_points: [] };
  return this.call_graph_cache;
}
```

**New**:

```typescript
get_call_graph(): CallGraph {
  if (this.call_graph_cache) {
    return this.call_graph_cache;
  }

  // Ensure all references are resolved
  this.resolve_all_pending();

  // Call detect_call_graph with registries
  const { detect_call_graph } = require('../trace_call_graph/detect_call_graph');

  this.call_graph_cache = detect_call_graph(
    this.semantic_indexes,
    this.definitions,
    this.scopes,
    this.resolutions
  );

  return this.call_graph_cache;
}
```

**Steps**:

1. Update implementation
2. Remove placeholder code
3. Add import (or use require for late binding)

**Validation**: Code compiles. Manual test with simple project.

---

### Phase 6: Fix All Tests (Validation)

**Goal**: Update test suite to use new signature.

**Current tests** ([detect_call_graph.test.ts](packages/core/src/trace_call_graph/detect_call_graph.test.ts)) create `ResolvedSymbols` objects.

**New tests** need to create:

- Mock SemanticIndex with references
- Mock DefinitionRegistry with definitions
- Mock ScopeRegistry with scope trees
- Mock ResolutionCache with resolutions

**Options**:

1. **Update existing tests**: Convert ResolvedSymbols to registry mocks
2. **Create test helpers**: Builder functions for creating test registries
3. **Hybrid approach**: Keep some tests minimal, add comprehensive integration tests

**Steps**:

1. Create test helper: `create_test_project()` that returns registries
2. Convert existing test cases one by one
3. Ensure all tests pass
4. Add new test cases for edge cases (missing scopes, etc.)

**Validation**: Full test suite passes.

---

## Iterative Negotiation Strategy

This is where the **analysis-led, iterative negotiation** happens. As we implement, we may discover:

### Potential Discoveries

1. **"Function scope matching is ambiguous"**
   → Add more matching criteria (e.g., check parent scope)
   → Or: Add explicit function_scope_id to FunctionDefinition

2. **"Anonymous functions have no name to match"**
   → Match by location only
   → Or: Use scope_id directly in definition

3. **"is_scope_within is expensive (O(depth) per call)"**
   → Add caching: build scope_to_function map once
   → Or: Add scope_depth field for quick checks

4. **"Nested functions cause issues"**
   → Refine boundary detection logic
   → Or: Add enclosing_function_id to scope

5. **"ResolutionCache doesn't track what's called"**
   → Build reverse index at resolution time
   → Or: Track in separate structure

### Adaptation Process

For each discovery:

1. **Document the issue** in implementation notes
2. **Propose 2-3 solutions** with trade-offs
3. **Choose simplest that works** (avoid over-engineering)
4. **Implement incrementally** (keep tests passing)
5. **Validate with real code** (run on actual TypeScript files)

---

## Risk Analysis

### High Risk

**Risk**: Function-to-scope matching fails for complex cases
**Mitigation**: Start with simple cases (top-level functions), add complexity incrementally
**Fallback**: Add explicit function_scope_id to definitions (semantic_index change)

**Risk**: Performance degradation from repeated scope traversals
**Mitigation**: Add caching layer (scope_id → enclosing_function_id map)
**Measurement**: Benchmark with 100+ function codebase

### Medium Risk

**Risk**: CallReference.scope_id not always populated correctly
**Mitigation**: Audit semantic_index building code
**Validation**: Add assertions in detect_call_graph

**Risk**: Test refactoring takes longer than implementation
**Mitigation**: Use test helpers, convert tests gradually
**Timeline**: Budget equal time for tests as implementation

### Low Risk

**Risk**: Registry API changes break other code
**Mitigation**: New methods only (no changes to existing)
**Validation**: Run full test suite after each phase

---

## Success Criteria

- ✅ `Project.get_call_graph()` returns correct CallGraph
- ✅ No adapter/intermediate structures (direct registry queries)
- ✅ All registry extensions have clear single purposes
- ✅ All existing detect_call_graph test cases pass (converted)
- ✅ Call graph works for single-file projects
- ✅ Call graph works for multi-file projects with imports
- ✅ Entry point detection works correctly
- ✅ Handles nested functions correctly
- ✅ Performance acceptable (< 1s for 1000 functions)

---

## Estimated Effort

- Phase 1 (Registry APIs): **4-6 hours**
- Phase 2 (Signature change): **1 hour**
- Phase 3 (build_function_nodes): **4-6 hours**
- Phase 4 (detect_entry_points): **1-2 hours**
- Phase 5 (Project integration): **1 hour**
- Phase 6 (Test updates): **6-8 hours**
- **Total: 17-24 hours**

Additional buffer for negotiation/iteration: **+30% = 22-31 hours**

---

## Implementation Notes

_(To be filled in during implementation)_

### Phase 1 Notes

### Phase 2 Notes

### Phase 3 Notes

### Phase 4 Notes

### Phase 5 Notes

### Phase 6 Notes

### Discoveries & Adaptations

### Performance Measurements

---

## Next Actions

1. Read this document thoroughly
2. Validate the analysis (challenge assumptions!)
3. Start Phase 1: Implement `ScopeRegistry.find_function_scope_for_definition()`
4. Test in isolation before moving to Phase 2
5. Document discoveries and adapt plan as needed

**This is a living document.** Update it as implementation reveals new insights.
