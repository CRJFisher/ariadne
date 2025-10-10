# Sub-task 139.1: Migrate build_type_context() to TypeRegistry

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: High (Foundation task)
**Complexity**: Low
**Estimated Effort**: 0.5-1 day

## Overview

Migrate PASS 1 and PASS 2 of `build_type_context()` to use TypeRegistry instead of accessing SemanticIndex type_bindings and type_members directly.

**Why start here?**
- ✅ Easiest migration (TypeRegistry API already perfect match)
- ✅ Zero registry enhancements needed
- ✅ Immediate value (cleaner separation of concerns)
- ✅ Good warm-up for harder sub-tasks
- ✅ Independent - no dependencies on other sub-tasks

## Current Implementation

**File**: `packages/core/src/resolve_references/type_resolution/type_context.ts`

```typescript
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  namespace_sources: NamespaceSources
): TypeContext {
  const symbol_types = new Map<SymbolId, SymbolId>();
  const type_members_map = new Map<SymbolId, Map<SymbolName, SymbolId>>();

  // PASS 1: Build symbol → type mappings using type_bindings
  for (const index of indices.values()) {
    for (const [loc_key, type_name] of index.type_bindings) {  // ← MIGRATE THIS
      const symbol_id = find_symbol_at_location(loc_key, index);
      // ... resolve type name ...
    }
  }

  // PASS 2: Build type member maps from type_members
  for (const index of indices.values()) {
    for (const [type_id, member_info] of index.type_members) {  // ← MIGRATE THIS
      // ... build member map ...
    }
  }

  // PASS 3: Not touched in this sub-task (uses index.type_members)
  // ...
}
```

## Target Implementation

```typescript
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  types: TypeRegistry,  // ← NEW PARAMETER
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  namespace_sources: NamespaceSources
): TypeContext {
  const symbol_types = new Map<SymbolId, SymbolId>();
  const type_members_map = new Map<SymbolId, Map<SymbolName, SymbolId>>();

  // PASS 1: Build symbol → type mappings using TypeRegistry
  for (const [file_id, index] of indices) {
    // Get all type bindings for this file from registry
    const type_bindings = types.get_file_type_bindings(file_id);  // ← NEW METHOD?

    for (const [loc_key, type_name] of type_bindings) {
      const symbol_id = find_symbol_at_location(loc_key, index);
      // ... same logic ...
    }
  }

  // PASS 2: Build type member maps from TypeRegistry
  for (const [file_id, index] of indices) {
    // Get all type members for this file from registry
    const file_type_members = types.get_file_type_members(file_id);  // ← NEW METHOD?

    for (const [type_id, member_info] of file_type_members) {
      // ... same logic ...
    }
  }
}
```

## Negotiation: Registry API Design

### Question 1: How to iterate over all type bindings?

**Option A**: Add bulk query method to TypeRegistry
```typescript
// In TypeRegistry
get_file_type_bindings(file_id: FilePath): Map<LocationKey, SymbolName>
get_file_type_members(file_id: FilePath): Map<SymbolId, TypeMemberInfo>
```

**Option B**: Keep indices for type data iteration
```typescript
// No changes to TypeRegistry, just document that clients should
// iterate indices and query registry for each item
for (const index of indices.values()) {
  for (const [loc_key, type_name] of index.type_bindings) {
    // This is fine - we're just iterating, not depending on index structure
  }
}
```

**Option C**: Make TypeRegistry iterable
```typescript
// In TypeRegistry
*get_all_type_bindings(): IterableIterator<[FilePath, LocationKey, SymbolName]>
*get_all_type_members(): IterableIterator<[FilePath, SymbolId, TypeMemberInfo]>
```

**Decision Point**: Which option is cleanest? Need to discuss trade-offs.

**Recommendation**: Option B for this sub-task (keep iterating indices). Why?
- TypeRegistry already has per-file storage internally (see derived_data.ts)
- Adding bulk queries now may be premature
- Can refactor iteration later if needed
- Keeps this sub-task focused on changing lookup calls

### Question 2: Which TypeRegistry methods to use?

Current TypeRegistry API (from derived_data.ts integration):
```typescript
class TypeRegistry {
  update_file(file_id: FilePath, derived: DerivedData): void
  get_type_binding(file_id: FilePath, location_key: LocationKey): SymbolName | undefined
  get_type_members(type_id: SymbolId): TypeMemberInfo | undefined
  // ... others ...
}
```

**Issue**: `build_type_context` iterates over ALL bindings, but TypeRegistry only has per-item lookup.

**Negotiation needed**: Does TypeRegistry need bulk access? Or keep iterating indices?

## Implementation Plan

### Step 1: Add TypeRegistry Parameter (No Logic Changes)
**Duration**: 30 min

```typescript
// Update signature
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  types: TypeRegistry,  // ← ADD THIS
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  namespace_sources: NamespaceSources
): TypeContext
```

**Update caller** (`symbol_resolution.ts`):
```typescript
const type_context = build_type_context(
  indices,
  types,  // ← ADD THIS (passed from resolve_symbols)
  resolver_index,
  cache,
  namespace_sources
);
```

**Run tests**: Should still pass (parameter added but not used)

---

### Step 2: Decide on Iteration Strategy
**Duration**: 1 hour (includes discussion)

**Evaluate options A, B, C above**. Test with simple prototype:
```typescript
// Prototype Option A
for (const [file_id, _] of indices) {
  const bindings = types.get_file_type_bindings(file_id);
  // Process bindings...
}

// Prototype Option B (recommended)
for (const [file_id, index] of indices) {
  for (const [loc_key, type_name] of index.type_bindings) {
    // Still iterate index, but could query registry if needed
  }
}
```

**Decision**: Document choice in task notes

---

### Step 3: Migrate PASS 1 (Type Bindings)
**Duration**: 1-2 hours

**If using Option B (keep iteration)**:
```typescript
// PASS 1: Build symbol → type mappings
for (const [file_id, index] of indices) {
  for (const [loc_key, type_name] of index.type_bindings) {
    // Iteration stays same, just documents that we *could* use registry here
    // No actual change needed - type_bindings already in TypeRegistry
  }
}
```

**Alternative (if TypeRegistry enhanced)**:
```typescript
// If we add get_file_type_bindings():
const bindings = types.get_file_type_bindings(file_id);
for (const [loc_key, type_name] of bindings) {
  // ... process ...
}
```

**Run tests**: Verify PASS 1 logic unchanged

---

### Step 4: Migrate PASS 2 (Type Members)
**Duration**: 1-2 hours

Same decision as PASS 1. Either:
- Keep iterating `index.type_members` (Option B)
- Use `types.get_file_type_members(file_id)` (Option A)

**Run tests**: Verify PASS 2 logic unchanged

---

### Step 5: Update Tests
**Duration**: 1-2 hours

**Files**: `type_context.test.ts`

**Changes**:
```typescript
// Before
const type_context = build_type_context(indices, resolver_index, cache, namespace_sources);

// After
const types = new TypeRegistry();
for (const [file_id, index] of indices) {
  const derived = build_derived_data(index);
  types.update_file(file_id, derived);
}

const type_context = build_type_context(indices, types, resolver_index, cache, namespace_sources);
```

**Or use test helper** (if we create one):
```typescript
const { types } = build_registries_from_indices(indices);
const type_context = build_type_context(indices, types, resolver_index, cache, namespace_sources);
```

**Run full test suite**: All type_context tests should pass

---

### Step 6: Update Documentation
**Duration**: 30 min

**Update JSDoc**:
```typescript
/**
 * Build type context from semantic indices
 *
 * Creates a type tracking system that:
 * 1. Maps symbols to their types (symbol_id → type_id)
 * 2. Provides member lookup for types (type_id → members)
 * 3. Provides namespace member lookup for namespace imports
 *
 * @param indices - All semantic indices (used for iteration and helper lookups)
 * @param types - Project-level type registry (provides type bindings and members)
 * @param resolver_index - Scope-aware symbol resolver for type name resolution
 * @param cache - Shared resolution cache
 * @param namespace_sources - Map of namespace symbol_id → source file path
 * @returns TypeContext implementation
 */
```

## Testing Strategy

### Unit Tests
**File**: `type_context.test.ts`

**Verify**:
- All existing tests still pass
- Type bindings resolve correctly
- Type members lookup works
- Namespace member resolution unchanged

**No new tests needed** - this is a refactor, not a feature

### Integration Tests
**File**: `symbol_resolution.typescript.test.ts`

**Verify**:
- End-to-end symbol resolution still works
- Method calls still resolve correctly
- Type-based resolution unchanged

## Acceptance Criteria

- [ ] `build_type_context()` signature updated to accept `TypeRegistry`
- [ ] All callers updated (mainly `symbol_resolution.ts`)
- [ ] PASS 1 and PASS 2 logic verified unchanged (even if still iterating indices)
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] JSDoc updated with new parameter
- [ ] Decision documented: which iteration strategy chosen (A/B/C)

## Notes

### Why Keep Iterating Indices?

Even if we keep `for (const [loc_key, type_name] of index.type_bindings)`, this is still progress because:
1. TypeRegistry now owns the type data (already populated in Project)
2. We've established the parameter passing pattern
3. Future: Can switch to registry iteration without changing signature
4. The semantic coupling is reduced even if syntactic coupling remains

### What About PASS 3?

PASS 3 (inheritance) still uses `index.type_members`. This sub-task intentionally leaves it for later because:
- PASS 3 also uses `index.exported_symbols` (not in scope)
- Want focused sub-task
- Can address in 139.3 after ExportRegistry is enhanced

### Lessons for Next Sub-tasks

This sub-task establishes the pattern:
1. Add parameter
2. Test with no logic changes
3. Decide on API (negotiate!)
4. Migrate incrementally
5. Test thoroughly
6. Document decisions

## Dependencies

**Prerequisite**: task-epic-11.138.9 (TypeRegistry passed to resolve_symbols)

**Enables**:
- 139.3 can follow same pattern for ExportRegistry
- Establishes parameter threading pattern for other sub-tasks

## Success Metrics

✅ Zero regressions
✅ Tests pass
✅ Code is cleaner (even if logic similar)
✅ Pattern established for future migrations
✅ Decision documented for iteration strategy
