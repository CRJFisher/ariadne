# Sub-task 139.7: Complete build_scope_resolver_index() Migration

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: Critical (Completes Phase C)
**Complexity**: Medium
**Estimated Effort**: 1-2 days

## Overview

Complete the migration of `build_scope_resolver_index()` to use registries. This is the **integration sub-task** that brings together all previous migrations (139.3, 139.5, 139.6).

**Why critical?**
- 🎯 **Completes Phase C** - all major functions now using registries
- 🔗 Integrates 139.3 (exports), 139.5 (find_local_definitions), 139.6 (extract_import_specs)
- ✅ After this, only references access SemanticIndex directly
- 🚀 Enables full registry-based symbol resolution

## Current State (After 139.3, 139.5, 139.6)

### Function Signature
**File**: `scope_resolver_index/scope_resolver_index.ts:115`

```typescript
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,  // ← Added in 139.3
  definitions: DefinitionRegistry,  // ← Added in 139.3
  root_folder: FileSystemFolder
): ScopeResolverIndex
```

**Status**: Signature partially updated, but implementation still needs work.

### Helper Functions Status

| Function | Status | Sub-task |
|----------|--------|----------|
| `find_local_definitions()` | ✅ Migrated | 139.5 |
| `extract_import_specs()` | ✅ Migrated | 139.6 |
| `resolve_export_chain()` | ✅ Updated | 139.3 |
| `build_resolvers_recursive()` | ⚠️ Partial | This task |

### Current Implementation Issues

1. **`build_resolvers_recursive` still accesses SemanticIndex directly**:
   - `index.scopes` → Should use ScopeRegistry
   - Still passes `index` to helper functions

2. **Scope tree traversal needs ScopeRegistry**:
   - Currently: `for (const child_id of scope.child_ids)`
   - Should use: `scopes.get_scope(child_id)`

## Target State

### Complete Signature

```typescript
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,  // Keep for references
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,  // ← ADD THIS
  exports: ExportRegistry,
  root_folder: FileSystemFolder
): ScopeResolverIndex
```

### build_resolvers_recursive Signature

```typescript
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,  // Keep for .language
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,  // Keep for resolve_export_chain
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,  // ← ADD THIS
  exports: ExportRegistry,
  root_folder: FileSystemFolder
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>>
```

## Implementation Plan

### Step 1: Add ScopeRegistry Parameter (1 hour)

**Update `build_scope_resolver_index` signature**:

```typescript
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,  // ← ADD
  exports: ExportRegistry,
  root_folder: FileSystemFolder
): ScopeResolverIndex {
  const scope_resolvers = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();

  for (const [file_path, index] of indices) {
    // Get root scope from ScopeRegistry instead of index
    const root_scope_id = scopes.get_file_root_scope(file_path).scope_id;

    const file_resolvers = build_resolvers_recursive(
      root_scope_id,
      new Map(),
      index,  // Keep for .language
      file_path,
      indices,
      definitions,
      scopes,  // ← ADD
      exports,
      root_folder
    );

    for (const [scope_id, resolvers] of file_resolvers) {
      scope_resolvers.set(scope_id, resolvers);
    }
  }

  return {
    resolve(scope_id: ScopeId, name: SymbolName, cache: ResolutionCache): SymbolId | null {
      // ... existing implementation ...
    },
  };
}
```

**Update caller in `symbol_resolution.ts`**:

```typescript
const resolver_index = build_scope_resolver_index(
  indices,
  definitions,
  scopes,  // ← ADD (already passed to resolve_symbols)
  exports,
  root_folder
);
```

---

### Step 2: Migrate build_resolvers_recursive Scope Access (2-3 hours)

**Update signature**:

```typescript
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,  // ← ADD
  exports: ExportRegistry,
  root_folder: FileSystemFolder
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>> {
  const result = new Map<ScopeId, Map<SymbolName, SymbolResolver>>();
  const resolvers = new Map<SymbolName, SymbolResolver>();

  // Get scope from ScopeRegistry instead of index.scopes
  const scope = scopes.get_scope(scope_id);  // ← CHANGED
  if (!scope) {
    throw new Error(`Scope not found: ${scope_id}`);
  }

  // Step 1: Inherit parent resolvers (unchanged)
  for (const [name, resolver] of parent_resolvers) {
    resolvers.set(name, resolver);
  }

  // Step 2: Add import resolvers
  const import_specs = extract_import_specs(
    scope_id,
    file_path,
    index.language,
    definitions,
    root_folder
  );

  for (const spec of import_specs) {
    if (spec.import_kind === "namespace") {
      resolvers.set(spec.local_name, () => spec.symbol_id);
    } else {
      resolvers.set(spec.local_name, () =>
        resolve_export_chain(
          spec.source_file,
          spec.import_name,
          indices,
          exports,
          definitions,
          root_folder,
          spec.import_kind
        )
      );
    }
  }

  // Step 3: Add local definition resolvers
  const local_defs = find_local_definitions(scope_id, file_path, definitions);

  for (const [name, symbol_id] of local_defs) {
    resolvers.set(name, () => symbol_id);
  }

  // Store this scope's resolvers
  result.set(scope_id, resolvers);

  // Step 4: Recurse to children using ScopeRegistry
  for (const child_id of scope.child_ids) {
    const child_resolvers = build_resolvers_recursive(
      child_id,
      resolvers,
      index,
      file_path,
      indices,
      definitions,
      scopes,  // ← ADD
      exports,
      root_folder
    );

    for (const [child_scope_id, child_scope_resolvers] of child_resolvers) {
      result.set(child_scope_id, child_scope_resolvers);
    }
  }

  return result;
}
```

**Key changes**:
- `index.scopes.get(scope_id)` → `scopes.get_scope(scope_id)`
- Thread `scopes` parameter through recursive calls

---

### Step 3: Verify No Direct SemanticIndex Field Access (1 hour)

**Audit remaining SemanticIndex access**:

```typescript
// Allowed (read-only metadata):
index.language  // ✅ OK (needed for resolve_module_path)

// Allowed (references not in registries):
index.references  // ✅ OK (in other functions, not here)

// Should be removed:
index.scopes  // ❌ Use scopes.get_scope()
index.functions  // ❌ Use definitions.get_scope_definitions()
index.variables  // ❌ Use definitions.get_scope_definitions()
index.scope_to_definitions  // ❌ Use definitions.get_scope_definitions()
index.exported_symbols  // ❌ Use exports.get_export_by_name()
```

**Grep for violations**:

```bash
cd packages/core/src/resolve_references/scope_resolver_index
grep -n "index\\.scopes" scope_resolver_index.ts
grep -n "index\\.functions" scope_resolver_index.ts
grep -n "index\\.variables" scope_resolver_index.ts
grep -n "index\\.classes" scope_resolver_index.ts
```

Should find **zero** matches (except in tests).

---

### Step 4: Update Tests (2-3 hours)

**File**: `scope_resolver_index.test.ts`

Update all tests to pass `scopes` registry:

```typescript
describe('build_scope_resolver_index', () => {
  it('should build resolver index for simple file', () => {
    const file_id = 'app.ts' as FilePath;
    const index = create_test_index(file_id, { /* ... */ });

    // Create registries
    const definitions = new DefinitionRegistry();
    const scopes = new ScopeRegistry();
    const exports = new ExportRegistry();

    // Populate registries
    const all_defs = [
      ...Array.from(index.functions.values()),
      ...Array.from(index.variables.values()),
      // ...
    ];

    definitions.update_file(file_id, all_defs);
    scopes.update_file(file_id, index.scopes);
    exports.update_file(file_id, /* ... */);

    // Build resolver index
    const resolver_index = build_scope_resolver_index(
      new Map([[file_id, index]]),
      definitions,
      scopes,  // ← ADD
      exports,
      root_folder
    );

    // ... assertions ...
  });
});
```

**Or use test helper** (update `resolve_symbols_with_registries` if needed).

---

### Step 5: Integration Testing (1-2 hours)

Run full test suite to ensure no regressions:

```bash
# Scope resolver tests
npm test -- scope_resolver_index.test.ts --run

# Symbol resolution integration tests
npm test -- symbol_resolution --run

# Namespace resolution tests
npm test -- namespace_resolution.test.ts --run
```

**Expected**: All tests pass with zero regressions.

---

### Step 6: Update Documentation (1 hour)

**Update JSDoc** for `build_scope_resolver_index`:

```typescript
/**
 * Build resolver index for all scopes across all files
 *
 * Creates a lightweight resolver function for every symbol in every scope.
 * Resolvers are organized hierarchically to implement shadowing.
 *
 * Process:
 * 1. For each file, build resolvers recursively from root scope
 * 2. Each scope inherits parent resolvers and adds its own
 * 3. Child resolvers override parent resolvers (shadowing)
 * 4. Final index maps scope_id → (name → resolver)
 *
 * @param indices - All semantic indices (used for .language metadata and by resolve_export_chain)
 * @param definitions - Project-level definition registry (provides scope-based queries)
 * @param scopes - Project-level scope registry (provides scope tree traversal)
 * @param exports - Project-level export registry (used by resolve_export_chain)
 * @param root_folder - Root of the file system tree
 * @returns ScopeResolverIndex with on-demand resolution capability
 */
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  exports: ExportRegistry,
  root_folder: FileSystemFolder
): ScopeResolverIndex
```

**Add note** about why `indices` is still needed:
- `.language` metadata (for resolve_module_path)
- Passed to resolve_export_chain (which validates file existence)

---

## Testing Strategy

### Unit Tests
- ✅ All existing `scope_resolver_index.test.ts` tests pass
- ✅ No new tests needed (this is a refactor)

### Integration Tests
- ✅ Symbol resolution still works end-to-end
- ✅ Namespace resolution still works
- ✅ Import resolution still works
- ✅ Shadowing behavior unchanged

### Regression Tests
- ✅ Run ENTIRE symbol resolution test suite
- ✅ Verify no performance regression

## Acceptance Criteria

- [ ] `build_scope_resolver_index()` accepts `scopes` parameter
- [ ] `build_resolvers_recursive()` uses `scopes.get_scope()` instead of `index.scopes`
- [ ] All scope tree traversal goes through ScopeRegistry
- [ ] Zero direct access to `index.scopes`, `index.functions`, `index.variables`, etc. (except `.language`)
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Integration with Phase A-B migrations complete

## Success Metrics

✅ **Phase C complete** - all major functions use registries
✅ All tests pass with zero regressions
✅ Code cleaner (minimal SemanticIndex dependencies)
✅ Only `index.references` and `index.language` accessed from SemanticIndex

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.3 (ExportRegistry and DefinitionRegistry threaded through)
- ✅ task-epic-11.139.5 (find_local_definitions migrated)
- ✅ task-epic-11.139.6 (extract_import_specs migrated)

**Enables**:
- 139.8 (test updates - integration complete)
- 139.9 (performance benchmarking)
- 139.10 (documentation)

## Risks & Mitigations

### Risk: Missing ScopeRegistry Methods
**Concern**: ScopeRegistry might not have all needed scope queries
**Mitigation**: ScopeRegistry already has `get_scope()`, `get_file_root_scope()`, which is all we need

### Risk: Performance Regression
**Concern**: Registry lookups might be slower than direct Map access
**Mitigation**: Registries use Maps internally, no measurable difference

### Risk: Test Breakage
**Concern**: Many tests may need updates
**Mitigation**: Test helper `resolve_symbols_with_registries` already populates all registries

## Notes

### What We Keep from SemanticIndex

After this sub-task, `build_scope_resolver_index` still accesses:
- ✅ `index.language` - Read-only metadata, acceptable
- ✅ `indices` map passed to `resolve_export_chain` - Needed for validation

**Everything else** goes through registries:
- Definitions → DefinitionRegistry
- Scopes → ScopeRegistry
- Exports → ExportRegistry

### Why This Completes Phase C

After 139.7:
- All helper functions migrated ✅
- All main functions use registries ✅
- Only `references` and metadata still in SemanticIndex ✅

**Phase D** (139.8-139.10) is just polish: tests, performance, docs.

### Integration Point for Future Work

This sub-task establishes the pattern for future incremental resolution:
- Could query ScopeRegistry for only changed scopes
- Could query DefinitionRegistry for only changed definitions
- Could rebuild only affected parts of resolver index

These optimizations are now **possible** because of registry architecture.
