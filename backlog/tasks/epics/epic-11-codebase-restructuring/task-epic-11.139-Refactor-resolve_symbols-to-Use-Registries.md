# Task: Refactor resolve_symbols to Use Registries

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Not Started
**Priority**: Medium
**Complexity**: High
**Estimated Effort**: 7-11 days (across all sub-tasks)

## Overview

Complete Phase 2 of task-epic-11.138.9: Refactor `resolve_symbols()` and all sub-functions to **actually use** the Project-level registries instead of accessing SemanticIndex fields directly.

**Current State**: Registries are passed to `resolve_symbols()` but not yet used (transitional state from task 138.9)

**Target State**: All sub-functions use registries; SemanticIndex access limited to `.references` only

## Background

Task 138.9 updated the signature of `resolve_symbols()` to accept 5 registries:

- DefinitionRegistry
- TypeRegistry
- ScopeRegistry
- ExportRegistry
- ImportGraph

However, the implementation still accesses SemanticIndex fields directly. This task completes the migration using an **iterative, negotiation-based approach**.

## Refactoring Philosophy: Iterative Negotiation

**Key Principle**: Registry APIs should emerge from actual client needs, not be designed upfront.

### The Approach

Each sub-task refactors **ONE vertical slice**:

1. Pick one client function (e.g., `build_type_context`)
2. Identify what it needs from registries (e.g., "lookup export by name")
3. **Negotiate**: Try using existing registry methods
4. **Enhance**: If existing methods don't fit, add new methods to registry
5. **Refactor**: Update client to use registry
6. **Iterate**: Discover additional needs, refine API
7. **Test**: Ensure no regressions

This approach ensures:

- ✅ Registry APIs match real usage patterns
- ✅ No over-engineering or unused methods
- ✅ Each sub-task is independently testable
- ✅ Can stop at any point with working system

## Current SemanticIndex Access Patterns

### Critical Finding: References Not in Registries

**ALL** sub-functions need `index.references` (SymbolReference[]), but there's no ReferenceRegistry.

**Decision**: Keep `indices` parameter for references. They are read-only and don't benefit from registry abstraction.

### Access Patterns by Function

| Function                       | Current Access                                                                                                          | Registry Migration                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `build_scope_resolver_index()` | `index.scopes`, `index.functions`, `index.variables`, `index.classes`, `index.interfaces`, `index.scope_to_definitions` | DefinitionRegistry + ScopeRegistry |
| `build_type_context()`         | `index.type_bindings`, `index.type_members`, `index.exported_symbols`                                                   | TypeRegistry + ExportRegistry      |
| `build_namespace_sources()`    | `index.imported_symbols`                                                                                                | DefinitionRegistry (imports)       |
| `resolve_function_calls()`     | `index.references`                                                                                                      | Keep indices ✅                    |
| `resolve_method_calls()`       | `index.references`                                                                                                      | Keep indices ✅                    |
| `resolve_constructor_calls()`  | `index.references`                                                                                                      | Keep indices ✅                    |
| `combine_results()`            | `index.references`, `index.functions`, `index.classes`                                                                  | Keep indices + DefinitionRegistry  |

## Sub-Tasks (Ordered by Complexity)

### Phase A: TypeRegistry Integration (Easiest)

**Sub-task 139.1**: Migrate `build_type_context()` to use TypeRegistry
**Status**: Not Started
**Effort**: 0.5-1 day
**Files**: `type_resolution/type_context.ts`

**Why first?**

- TypeRegistry API already matches needs perfectly
- No enhancements required
- Low risk, immediate value
- Good warm-up for harder tasks

**Migration**:

- PASS 1: `index.type_bindings` → `types.get_type_binding()`
- PASS 2: `index.type_members` → `types.get_type_members()`

---

### Phase B: ExportRegistry Enhancement (Moderate)

**Sub-task 139.2**: Add Name-Based Export Lookup to ExportRegistry
**Status**: Not Started
**Effort**: 1-1.5 days
**Files**: `project/export_registry.ts`

**Enhancement Needed**:

```typescript
/**
 * Get exported definition by name
 * Used for namespace member resolution and re-export chains
 */
get_export_by_name(
  file_id: FilePath,
  name: SymbolName,
  definitions: DefinitionRegistry
): AnyDefinition | undefined
```

**Negotiation Points**:

- Should ExportRegistry depend on DefinitionRegistry? Or take it as parameter?
- Should we cache name→definition mappings?
- How to handle export aliases (export { foo as bar })?

---

**Sub-task 139.3**: Migrate Export Lookups to ExportRegistry
**Status**: Not Started
**Effort**: 1-2 days
**Files**: `type_resolution/type_context.ts`, `import_resolution/import_resolver.ts`

**Migration**:

- `index.exported_symbols.get(name)` → `exports.get_export_by_name(file_id, name, definitions)`
- Update `resolve_export_chain()` to use new method
- Update namespace member resolution in `build_type_context()`

---

### Phase C: DefinitionRegistry + ScopeRegistry (Hardest)

**Sub-task 139.4**: Add Scope-Based Definition Queries to DefinitionRegistry
**Status**: Not Started
**Effort**: 2-3 days
**Files**: `project/definition_registry.ts`

**Enhancement Needed**:

```typescript
/**
 * Get all definitions in a specific scope
 * Used for building scope resolver index
 */
get_scope_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  kind?: SymbolKind
): AnyDefinition[]
```

**Negotiation Points**:

- Should we build/cache a scope→definitions index?
- Or compute on-demand by filtering get_file_definitions()?
- Performance: O(1) with index vs O(n) with filtering?
- When to rebuild index (on every update_file)?

**Design Decision Required**:
Current SemanticIndex has `scope_to_definitions: Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>`

- Option A: Replicate this in DefinitionRegistry
- Option B: Compute on-demand (simpler but slower)
- Option C: Lazy index built on first query per file

---

**Sub-task 139.5**: Migrate `find_local_definitions()` to Use DefinitionRegistry
**Status**: Not Started
**Effort**: 1 day
**Files**: `scope_resolver_index/scope_resolver_index.ts`

**Migration**:

```typescript
// Before
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): Map<SymbolName, SymbolId> {
  // Scans index.functions, index.variables, index.classes, etc.
  // Filters by defining_scope_id === scope_id
}

// After
function find_local_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  definitions: DefinitionRegistry
): Map<SymbolName, SymbolId> {
  const defs = definitions.get_scope_definitions(scope_id, file_id);
  // Convert to Map<SymbolName, SymbolId>
}
```

---

**Sub-task 139.6**: Migrate `extract_import_specs()` to Use DefinitionRegistry
**Status**: Not Started
**Effort**: 1-2 days
**Files**: `import_resolution/import_resolver.ts`

**Migration**:

```typescript
// Before
const import_defs =
  index.scope_to_definitions.get(scope_id)?.get("import") || [];

// After
const import_defs = definitions.get_scope_definitions(
  scope_id,
  file_id,
  "import"
);
```

**Design Decision**: ImportDefinitions should be stored in DefinitionRegistry (they implement AnyDefinition interface)

---

**Sub-task 139.7**: Update `build_scope_resolver_index()` Signature
**Status**: Not Started
**Effort**: 1-2 days
**Files**: `scope_resolver_index/scope_resolver_index.ts`, all callers

**Migration**:

```typescript
// Before
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder
): ScopeResolverIndex;

// After
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>, // Keep for references
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  root_folder: FileSystemFolder
): ScopeResolverIndex;
```

**Also update**:

- `find_local_definitions()` calls
- `extract_import_specs()` calls
- All tests

---

### Phase D: Integration & Cleanup

**Sub-task 139.8**: Update Tests for Registry-Based APIs
**Status**: Not Started
**Effort**: 2-3 days
**Files**: All `*.test.ts` files in resolve_references

**Updates**:

- Sub-function tests (scope_resolver_index, type_context, import_resolver)
- Integration tests
- Add cross-file resolution tests

---

**Sub-task 139.9**: Performance Benchmarking & Optimization
**Status**: Not Started
**Effort**: 1 day
**Files**: New benchmark file

**Goals**:

- Compare before/after performance
- Identify any regressions
- Optimize hot paths (scope_to_definitions queries)
- Target: <5% regression

---

**Sub-task 139.10**: Update Documentation
**Status**: Not Started
**Effort**: 0.5 day
**Files**: README, JSDoc comments

**Updates**:

- Document new registry methods
- Update resolve_symbols architecture docs
- Add migration guide for future refactors

---

## Dependencies

**Prerequisite**: task-epic-11.138.9 (completed)

**Sub-task Dependencies**:

- 139.1 → Independent (can start immediately)
- 139.2 → Independent
- 139.3 → Requires 139.2
- 139.4 → Independent
- 139.5 → Requires 139.4
- 139.6 → Requires 139.4
- 139.7 → Requires 139.5, 139.6
- 139.8 → Requires 139.1-139.7
- 139.9 → Requires 139.8
- 139.10 → Requires all

**Parallelization**:

- Can work on 139.1 and 139.2/139.4 in parallel
- Phases A, B, C are independent initially

## Risks & Mitigations

### Risk 1: Scope-to-Definitions Performance

**Concern**: Querying definitions by scope may be slower than direct Map access
**Mitigation**: Sub-task 139.4 explores caching strategies; can optimize if needed

### Risk 2: API Churn

**Concern**: Registry APIs may need multiple iterations
**Mitigation**: That's the point! Iterative design is intentional, not a bug

### Risk 3: Breaking Tests

**Concern**: Widespread changes may break many tests
**Mitigation**: Incremental approach means tests break one function at a time

### Risk 4: Over-Engineering

**Concern**: Registries may become too complex
**Mitigation**: Only add methods when clients demonstrate need; reject speculative features

## Success Criteria

✅ All sub-tasks completed (139.1 - 139.10)
✅ Zero direct access to SemanticIndex fields except `.references`
✅ All tests passing with no regressions
✅ Performance within 5% of baseline
✅ Registry APIs are clean and well-documented
✅ Code is more maintainable than before refactor

## Acceptance Criteria

- [ ] TypeRegistry fully integrated (139.1)
- [ ] ExportRegistry enhanced and integrated (139.2-139.3)
- [ ] DefinitionRegistry enhanced and integrated (139.4-139.7)
- [ ] All tests updated and passing (139.8)
- [ ] Performance benchmarked (139.9)
- [ ] Documentation updated (139.10)
- [ ] Zero SemanticIndex field access except `.references`
- [ ] All registry methods have clear JSDoc
- [ ] Integration tests for cross-file resolution

## Notes

### Why Not Design Everything Upfront?

Traditional approach:

1. Design complete registry APIs
2. Implement all methods
3. Update all clients
4. Discover APIs don't quite fit
5. Redesign and repeat

**Our approach**:

1. Pick one client
2. Try using existing methods
3. Discover what's missing
4. Add ONLY what's needed
5. Refactor client
6. Learn from experience
7. Repeat for next client

This **agile, negotiation-based** approach leads to better APIs because they emerge from real usage, not speculation.

### Stopping Points

Each sub-task is a natural stopping point. If priorities shift:

- After 139.1: TypeRegistry integrated (some value)
- After 139.3: Type + Export registries done (medium value)
- After 139.7: Full integration (high value)
- After 139.10: Complete (maximum value)

### Future Work

This refactoring enables:

- Incremental cross-file resolution
- Smarter caching strategies
- Lazy registry population
- Parallel file processing
- Better memory management

---

## Estimated Timeline

| Phase     | Sub-tasks        | Effort         | Dependencies       |
| --------- | ---------------- | -------------- | ------------------ |
| A         | 139.1            | 0.5-1 day      | None               |
| B         | 139.2-139.3      | 2-3.5 days     | None initially     |
| C         | 139.4-139.7      | 5-8 days       | 139.4 gates others |
| D         | 139.8-139.10     | 3.5-4.5 days   | All previous       |
| **Total** | **139.1-139.10** | **11-17 days** | Phased             |

**Recommended Schedule**:

- Week 1: 139.1, 139.2, 139.4 (foundations)
- Week 2: 139.3, 139.5, 139.6 (client migrations)
- Week 3: 139.7, 139.8 (integration)
- Week 4: 139.9, 139.10 (polish)

---

## Next Steps

1. Review this task plan
2. Decide on sub-task 139.4 design (scope-to-definitions caching strategy)
3. Start with 139.1 (TypeRegistry - easy win)
4. Iterate through sub-tasks in order
5. Stop at natural boundaries if priorities change
