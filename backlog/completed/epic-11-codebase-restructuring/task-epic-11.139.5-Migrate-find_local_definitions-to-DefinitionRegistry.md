# Sub-task 139.5: Migrate find_local_definitions() to DefinitionRegistry

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: High
**Complexity**: Low-Medium
**Estimated Effort**: 1 day

## Overview

Migrate `find_local_definitions()` from scanning SemanticIndex maps to using `DefinitionRegistry.get_scope_definitions()` added in sub-task 139.4.

**Why needed?**
- ✅ Sub-task 139.4 added the capability
- 🎯 Removes inefficient O(n) scan through all definitions
- 📈 Uses O(1) cached scope queries
- 🔄 Major performance improvement for scope resolver building

## Current Implementation

**File**: `scope_resolver_index/scope_resolver_index.ts:273-320`

```typescript
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): ReadonlyMap<SymbolName, SymbolId> {
  const defs = new Map<SymbolName, SymbolId>();

  // Functions - O(n) scan!
  for (const [func_id, func_def] of index.functions) {
    if (func_def.defining_scope_id === scope_id) {
      defs.set(func_def.name, func_id);
    }
  }

  // Variables - O(n) scan!
  for (const [var_id, var_def] of index.variables) {
    if (var_def.defining_scope_id === scope_id) {
      defs.set(var_def.name, var_id);
    }
  }

  // Classes - O(n) scan!
  for (const [class_id, class_def] of index.classes) {
    if (class_def.defining_scope_id === scope_id) {
      defs.set(class_def.name, class_id);
    }
  }

  // Interfaces, enums, namespaces, types... all O(n) scans!
  // ...

  return defs;
}
```

**Performance**: O(n * m) where n = # of scopes, m = # of definitions per file
- Called for EVERY scope during index building
- Very inefficient for large files

## Target Implementation

```typescript
function find_local_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  definitions: DefinitionRegistry
): ReadonlyMap<SymbolName, SymbolId> {
  const defs = new Map<SymbolName, SymbolId>();

  // Get all definitions in this scope - O(1) after cache!
  const scope_defs = definitions.get_scope_definitions(scope_id, file_id);

  // Map to name → symbol_id
  for (const def of scope_defs) {
    defs.set(def.name, def.symbol_id);
  }

  return defs;
}
```

**Performance**: O(1) after initial cache build + O(k) where k = definitions in scope
- Much faster for large files
- Leverages DefinitionRegistry's lazy cache

## Implementation Plan

### Step 1: Update Function Signature (30 min)

```typescript
// Before
function find_local_definitions(
  scope_id: ScopeId,
  index: SemanticIndex
): ReadonlyMap<SymbolName, SymbolId>

// After
function find_local_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  definitions: DefinitionRegistry
): ReadonlyMap<SymbolName, SymbolId>
```

### Step 2: Update Implementation (30 min)

```typescript
function find_local_definitions(
  scope_id: ScopeId,
  file_id: FilePath,
  definitions: DefinitionRegistry
): ReadonlyMap<SymbolName, SymbolId> {
  const defs = new Map<SymbolName, SymbolId>();

  // Query registry for all definitions in this scope
  const scope_defs = definitions.get_scope_definitions(scope_id, file_id);

  // Build name → symbol_id map
  for (const def of scope_defs) {
    // Skip definitions without names (shouldn't happen, but be defensive)
    if (!def.name) continue;

    defs.set(def.name, def.symbol_id);
  }

  return defs;
}
```

### Step 3: Update Caller in build_resolvers_recursive (1 hour)

**File**: `scope_resolver_index.ts:220`

```typescript
// Before
const local_defs = find_local_definitions(scope_id, index);

// After
const local_defs = find_local_definitions(scope_id, file_path, definitions);
```

But wait - `build_resolvers_recursive` doesn't have `definitions` parameter yet!

**Update signature**:
```typescript
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,  // ← From 139.3
  definitions: DefinitionRegistry,  // ← ADD THIS
  root_folder: FileSystemFolder
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>>
```

**Update all recursive calls** to pass `definitions` through.

### Step 4: Update build_scope_resolver_index (1 hour)

**File**: `scope_resolver_index.ts:115`

Signature was partially updated in 139.3:
```typescript
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,
  definitions: DefinitionRegistry,  // ← Already added in 139.3
  root_folder: FileSystemFolder
): ScopeResolverIndex
```

Now update the call to `build_resolvers_recursive`:
```typescript
const file_resolvers = build_resolvers_recursive(
  index.root_scope_id,
  new Map(),
  index,
  file_path,
  indices,
  exports,
  definitions,  // ← ADD THIS
  root_folder
);
```

### Step 5: Update Tests (2-3 hours)

**File**: `scope_resolver_index.test.ts`

Update all tests that call `find_local_definitions` directly or `build_scope_resolver_index`:

```typescript
// Before
const resolver_index = build_scope_resolver_index(indices, root_folder);

// After
const definitions = new DefinitionRegistry();

// Populate definitions from indices
for (const [file_id, index] of indices) {
  const all_defs: AnyDefinition[] = [
    ...Array.from(index.functions.values()),
    ...Array.from(index.variables.values()),
    ...Array.from(index.classes.values()),
    ...Array.from(index.interfaces.values()),
    ...Array.from(index.enums.values()),
    ...Array.from(index.namespaces.values()),
    ...Array.from(index.types.values()),
    ...Array.from(index.imported_symbols.values()),
  ];
  definitions.update_file(file_id, all_defs);
}

const exports = new ExportRegistry();
// ... populate exports ...

const resolver_index = build_scope_resolver_index(
  indices,
  exports,
  definitions,
  root_folder
);
```

**Or use updated test helper** from `symbol_resolution.test_helpers.ts` which already does this.

### Step 6: Performance Verification (1 hour)

Add benchmark test:

```typescript
it('should handle large files efficiently with DefinitionRegistry', () => {
  // Create file with 100 scopes, 10 definitions each
  const file_id = 'large.ts' as FilePath;
  const index = create_test_index(file_id, {
    // ... 1000 definitions across 100 scopes
  });

  const definitions = new DefinitionRegistry();
  // ... populate ...

  // Measure time to build scope resolver index
  const start = performance.now();
  const resolver_index = build_scope_resolver_index(
    new Map([[file_id, index]]),
    new ExportRegistry(),
    definitions,
    root_folder
  );
  const time = performance.now() - start;

  // Should be significantly faster than O(n²)
  expect(time).toBeLessThan(100);  // < 100ms for 1000 definitions
});
```

Compare with previous implementation to verify speedup.

## Testing Strategy

### Unit Tests
- ✅ `find_local_definitions` returns correct definitions for scope
- ✅ Empty scopes handled correctly
- ✅ Multiple definitions with same kind work
- ✅ All SymbolKinds represented

### Integration Tests
- ✅ `build_scope_resolver_index` still builds correctly
- ✅ Symbol resolution still works end-to-end
- ✅ Shadowing behavior unchanged
- ✅ Import resolution unchanged

### Performance Tests
- ✅ Faster than previous O(n²) implementation
- ✅ Scales well with large files

## Acceptance Criteria

- [ ] `find_local_definitions()` signature updated
- [ ] Implementation uses `definitions.get_scope_definitions()`
- [ ] `build_resolvers_recursive()` signature updated
- [ ] All callers updated
- [ ] All tests passing
- [ ] Performance improvement verified
- [ ] No SemanticIndex map scanning in `find_local_definitions()`

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.4 (DefinitionRegistry.get_scope_definitions exists)
- ✅ task-epic-11.139.3 (build_scope_resolver_index signature partially updated)

**Enables**:
- Part of 139.7 (full build_scope_resolver_index migration)

## Success Metrics

✅ All tests pass
✅ Measurable performance improvement
✅ Code simpler (no manual scanning)
✅ O(1) queries after cache warm-up

## Notes

### Why This Is High Impact

This is one of the **hottest paths** in the entire resolution pipeline:
- Called for EVERY scope during index build
- Current O(n²) complexity very noticeable on large files
- DefinitionRegistry cache makes it O(1)

Expected speedup: **10-100x** for files with many scopes.

### Interaction with 139.3

Sub-task 139.3 already started updating `build_scope_resolver_index` to accept `exports` and `definitions`. This sub-task continues that work.

By the end of 139.5:
- `build_scope_resolver_index` accepts both `exports` and `definitions` ✅
- `find_local_definitions` uses `definitions` ✅
- Still need 139.6 and 139.7 to complete the migration
