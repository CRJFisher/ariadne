# Sub-task 139.3: Migrate Export Lookups to ExportRegistry

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 1-2 days

## Overview

Migrate all direct `index.exported_symbols` access to use the new `ExportRegistry.get_export_by_name()` method added in sub-task 139.2.

**Why needed?**
- ✅ Sub-task 139.2 added the capability
- 🎯 Now we need to actually USE it
- 🔄 Removes direct SemanticIndex.exported_symbols dependency
- 📍 Two main clients: `build_type_context()` and `resolve_export_chain()`

## Current State

### Client #1: Namespace Member Resolution
**File**: `type_resolution/type_context.ts:324`

```typescript
// Inside TypeContext implementation
get_namespace_member(
  namespace_id: SymbolId,
  member_name: SymbolName
): SymbolId | null {
  const source_file = namespace_sources.get(namespace_id);
  if (!source_file) return null;

  const source_index = indices.get(source_file);  // ← Still using indices!
  if (!source_index) return null;

  // Direct SemanticIndex access
  const exported_def = source_index.exported_symbols.get(member_name);  // ← MIGRATE THIS
  return exported_def?.symbol_id || null;
}
```

**Usage**: When resolving `utils.helper()` where `utils` is a namespace import, look up `helper` in the source file's exports.

---

### Client #2: Export Chain Resolution
**File**: `import_resolution/import_resolver.ts:180-214`

```typescript
function find_export(
  export_name: SymbolName,
  index: SemanticIndex
): ExportInfo | null {
  // Direct SemanticIndex access
  const def = index.exported_symbols.get(export_name);  // ← MIGRATE THIS
  if (!def) return null;

  // Check if it's a re-export
  if (is_reexport(def)) {
    return {
      symbol_id: null,
      re_export_source: def.import_path,
      re_export_name: def.original_name || export_name,
      is_default: def.import_kind === "default",
    };
  }

  return {
    symbol_id: def.symbol_id,
    re_export_source: null,
    re_export_name: null,
    is_default: false,
  };
}

function find_default_export(index: SemanticIndex): ExportInfo | null {
  // Scan all exports looking for is_default flag
  for (const def of index.exported_symbols.values()) {  // ← MIGRATE THIS
    if ((def as any).is_default) {
      // Similar logic to find_export
    }
  }
  return null;
}
```

**Usage**: Following re-export chains like:
```typescript
// base.ts
export function core() {}

// middle.ts
export { core } from './base'

// main.ts
import { core } from './middle'  // ← Resolves through chain
```

---

## Target State

### Client #1: Namespace Member Resolution (After)

```typescript
// Inside TypeContext implementation
get_namespace_member(
  namespace_id: SymbolId,
  member_name: SymbolName
): SymbolId | null {
  const source_file = namespace_sources.get(namespace_id);
  if (!source_file) return null;

  // Use ExportRegistry instead of SemanticIndex
  const exported_def = exports.get_export_by_name(
    source_file,
    member_name,
    definitions  // ← Need to thread DefinitionRegistry through
  );

  return exported_def?.symbol_id || null;
}
```

**Challenge**: TypeContext doesn't currently have `exports` or `definitions` parameters!

---

### Client #2: Export Chain Resolution (After)

```typescript
function find_export(
  export_name: SymbolName,
  file_id: FilePath,  // ← Changed from SemanticIndex
  exports: ExportRegistry,  // ← NEW
  definitions: DefinitionRegistry  // ← NEW
): ExportInfo | null {
  // Use ExportRegistry instead of SemanticIndex
  const def = exports.get_export_by_name(file_id, export_name, definitions);
  if (!def) return null;

  // Same logic as before
  if (is_reexport(def)) {
    return {
      symbol_id: null,
      re_export_source: def.import_path,
      re_export_name: def.original_name || export_name,
      is_default: def.import_kind === "default",
    };
  }

  return {
    symbol_id: def.symbol_id,
    re_export_source: null,
    re_export_name: null,
    is_default: false,
  };
}
```

**Challenge**: Functions need new parameters, all callers must be updated!

---

## Implementation Plan

### Phase 1: Update `build_type_context()` Signature (Day 1 AM)
**Duration**: 1-2 hours

**Step 1.1**: Add ExportRegistry and DefinitionRegistry parameters

```typescript
// Before
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  types: TypeRegistry,  // ← Added in 139.1
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  namespace_sources: NamespaceSources
): TypeContext

// After
export function build_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  types: TypeRegistry,
  exports: ExportRegistry,  // ← ADD THIS
  definitions: DefinitionRegistry,  // ← ADD THIS
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  namespace_sources: NamespaceSources
): TypeContext
```

**Step 1.2**: Update caller in `symbol_resolution.ts`

```typescript
const type_context = build_type_context(
  indices,
  types,
  exports,  // ← ADD THIS (already passed to resolve_symbols)
  definitions,  // ← ADD THIS (already passed to resolve_symbols)
  resolver_index,
  cache,
  namespace_sources
);
```

**Step 1.3**: Run tests - should still pass (parameters added but not used yet)

---

### Phase 2: Migrate Namespace Member Resolution (Day 1 AM-PM)
**Duration**: 2-3 hours

**Step 2.1**: Update `get_namespace_member()` implementation

```typescript
// Inside build_type_context function body
const type_context_impl: TypeContext = {
  // ... existing methods ...

  get_namespace_member(
    namespace_id: SymbolId,
    member_name: SymbolName
  ): SymbolId | null {
    const source_file = namespace_sources.get(namespace_id);
    if (!source_file) return null;

    // NEW: Use ExportRegistry instead of SemanticIndex
    const exported_def = exports.get_export_by_name(
      source_file,
      member_name,
      definitions
    );

    return exported_def?.symbol_id || null;
  },
};
```

**Step 2.2**: Remove `indices` lookup (no longer needed for this method)

**Step 2.3**: Run namespace resolution tests

```bash
npm test -- namespace_resolution.test.ts --run
```

Expected: All tests should still pass

---

### Phase 3: Migrate Export Chain Resolution (Day 1 PM - Day 2 AM)
**Duration**: 3-4 hours

**Step 3.1**: Update `find_export()` signature

```typescript
// Before
function find_export(
  export_name: SymbolName,
  index: SemanticIndex
): ExportInfo | null

// After
function find_export(
  export_name: SymbolName,
  file_id: FilePath,
  exports: ExportRegistry,
  definitions: DefinitionRegistry
): ExportInfo | null
```

**Step 3.2**: Update `find_export()` implementation

```typescript
function find_export(
  export_name: SymbolName,
  file_id: FilePath,
  exports: ExportRegistry,
  definitions: DefinitionRegistry
): ExportInfo | null {
  const def = exports.get_export_by_name(file_id, export_name, definitions);
  if (!def) return null;

  // Same logic as before
  if (is_reexport(def)) {
    return {
      symbol_id: null,
      re_export_source: (def as ImportDefinition).import_path,
      re_export_name: (def as ImportDefinition).original_name || export_name,
      is_default: (def as ImportDefinition).import_kind === "default",
    };
  }

  return {
    symbol_id: def.symbol_id,
    re_export_source: null,
    re_export_name: null,
    is_default: false,
  };
}
```

**Step 3.3**: Update `find_default_export()` similarly

```typescript
function find_default_export(
  file_id: FilePath,
  exports: ExportRegistry,
  definitions: DefinitionRegistry
): ExportInfo | null {
  // Get all exports for the file
  const all_exports = exports.get_exported_definitions(file_id, definitions);

  // Find the one marked as default
  for (const def of all_exports) {
    if ((def as any).is_default) {
      if (is_reexport(def)) {
        return {
          symbol_id: null,
          re_export_source: (def as ImportDefinition).import_path,
          re_export_name: (def as ImportDefinition).original_name || (def as ImportDefinition).name,
          is_default: true,
        };
      }

      return {
        symbol_id: def.symbol_id,
        re_export_source: null,
        re_export_name: null,
        is_default: true,
      };
    }
  }

  return null;
}
```

**Step 3.4**: Update `resolve_export_chain()` signature

```typescript
// Before
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder,
  import_kind: "named" | "default" | "namespace" = "named",
  visited: Set<string> = new Set()
): SymbolId | null

// After
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,  // Keep for now (used elsewhere)
  exports: ExportRegistry,  // ← ADD
  definitions: DefinitionRegistry,  // ← ADD
  root_folder: FileSystemFolder,
  import_kind: "named" | "default" | "namespace" = "named",
  visited: Set<string> = new Set()
): SymbolId | null
```

**Step 3.5**: Update `resolve_export_chain()` implementation

```typescript
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,
  definitions: DefinitionRegistry,
  root_folder: FileSystemFolder,
  import_kind: "named" | "default" | "namespace" = "named",
  visited: Set<string> = new Set()
): SymbolId | null {
  // Check if source file exists in indices (still needed for validation)
  const source_index = indices.get(source_file);
  if (!source_index) {
    throw new Error(`Source index not found for file: ${source_file}`);
  }

  // Cycle detection (unchanged)
  const key = import_kind === "default"
    ? `${source_file}:default`
    : `${source_file}:${export_name}:${import_kind}`;

  if (visited.has(key)) {
    return null;
  }
  visited.add(key);

  // NEW: Use helper functions with ExportRegistry
  const export_info = import_kind === "default"
    ? find_default_export(source_file, exports, definitions)
    : find_export(export_name, source_file, exports, definitions);

  if (!export_info) {
    throw new Error(
      import_kind === "default"
        ? `Default export not found in file: ${source_file}`
        : `Export not found for symbol: ${export_name} in file: ${source_file}`
    );
  }

  // If direct export, return symbol_id
  if (export_info.symbol_id) {
    return export_info.symbol_id;
  }

  // If re-export, follow the chain recursively
  if (export_info.re_export_source) {
    const re_export_file = resolve_module_path(
      export_info.re_export_source,
      source_file,
      source_index.language,
      root_folder
    );

    return resolve_export_chain(
      re_export_file,
      export_info.re_export_name || export_name,
      indices,
      exports,  // ← Thread through
      definitions,  // ← Thread through
      root_folder,
      export_info.is_default ? "default" : "named",
      visited
    );
  }

  return null;
}
```

---

### Phase 4: Update All Callers (Day 2 AM)
**Duration**: 2-3 hours

**Callers of `resolve_export_chain()`**:

1. **In `scope_resolver_index.ts`** - Import resolvers

```typescript
// Inside build_resolvers_recursive
resolvers.set(spec.local_name, () =>
  resolve_export_chain(
    spec.source_file,
    spec.import_name,
    indices,
    exports,  // ← ADD (need to thread through from build_scope_resolver_index)
    definitions,  // ← ADD
    root_folder,
    spec.import_kind
  )
);
```

**Challenge**: `build_scope_resolver_index()` doesn't have `exports` or `definitions` yet!

**Solution**: This will be addressed in sub-task 139.7, but for now we need to thread them through:

```typescript
// Update build_scope_resolver_index signature (partial, full update in 139.7)
export function build_scope_resolver_index(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,  // ← ADD
  definitions: DefinitionRegistry,  // ← ADD
  root_folder: FileSystemFolder
): ScopeResolverIndex
```

**Then update caller in `symbol_resolution.ts`**:

```typescript
const resolver_index = build_scope_resolver_index(
  indices,
  exports,  // ← ADD
  definitions,  // ← ADD
  root_folder
);
```

2. **Inside `build_resolvers_recursive()`** - Thread parameters through

```typescript
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,  // ← ADD
  definitions: DefinitionRegistry,  // ← ADD
  root_folder: FileSystemFolder
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>>
```

**Update all recursive calls** within the function to pass these through.

---

### Phase 5: Update Tests (Day 2 PM)
**Duration**: 2-3 hours

**Test files to update**:

1. `type_context.test.ts` - Namespace member tests
2. `import_resolver.test.ts` - Export chain tests
3. `import_resolver.typescript.test.ts`
4. `import_resolver.javascript.test.ts`
5. `import_resolver.python.test.ts`
6. `import_resolver.rust.test.ts`

**Pattern for updates**:

```typescript
// Before
const type_context = build_type_context(
  indices,
  types,
  resolver_index,
  cache,
  namespace_sources
);

// After
const exports = new ExportRegistry();
const definitions = new DefinitionRegistry();

// Populate registries from indices
for (const [file_id, index] of indices) {
  const derived = build_derived_data(index);

  // Update registries
  const all_defs = [
    ...Array.from(index.functions.values()),
    ...Array.from(index.classes.values()),
    // ... etc
  ];
  definitions.update_file(file_id, all_defs);

  const exported_ids = new Set(
    Array.from(derived.exported_symbols.values()).map(def => def.symbol_id)
  );
  exports.update_file(file_id, exported_ids);
}

const type_context = build_type_context(
  indices,
  types,
  exports,  // ← ADD
  definitions,  // ← ADD
  resolver_index,
  cache,
  namespace_sources
);
```

**Or use test helper** (update `resolve_symbols_with_registries` to include these):

```typescript
// In symbol_resolution.test_helpers.ts
export function resolve_symbols_with_registries(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder
): ResolvedSymbols {
  const definitions = new DefinitionRegistry();
  const types = new TypeRegistry();
  const scopes = new ScopeRegistry();
  const exports = new ExportRegistry();
  const imports = new ImportGraph();

  // ... populate all registries ...

  return resolve_symbols(
    indices,
    definitions,
    types,
    scopes,
    exports,
    imports,
    root_folder
  );
}
```

Tests already use this helper, so they should "just work" after helper is updated.

---

## Negotiation Points

### Question 1: Should indices parameter stay in resolve_export_chain?

**Current approach**: Keep `indices` for validation check:
```typescript
const source_index = indices.get(source_file);
if (!source_index) {
  throw new Error(`Source index not found for file: ${source_file}`);
}
```

**Alternative**: Remove indices entirely, trust that exports/definitions have the data:
```typescript
// Just try to use exports, throw if not found
const export_info = find_export(export_name, source_file, exports, definitions);
```

**Decision**: Keep indices for now (validation is useful), can remove later if proven unnecessary.

---

### Question 2: Default export detection - is there a better way?

**Current approach**: Scan all exports looking for `is_default` flag:
```typescript
for (const def of all_exports) {
  if ((def as any).is_default) { ... }
}
```

**Issue**: Assumes all definitions have `is_default` property (they don't - it's only on ImportDefinition for re-exports)

**Better approach**: ExportRegistry could track default export separately:
```typescript
class ExportRegistry {
  private default_exports: Map<FilePath, SymbolId> = new Map()

  get_default_export(file_id: FilePath): SymbolId | undefined {
    return this.default_exports.get(file_id);
  }
}
```

**Negotiation**: Try current approach first, add `get_default_export()` if needed.

---

## Testing Strategy

### Unit Tests
- ✅ Namespace member resolution still works
- ✅ Export chain following still works
- ✅ Re-exports resolve correctly
- ✅ Default exports resolve correctly
- ✅ Cycle detection still works
- ✅ Error cases handled (missing exports, etc.)

### Integration Tests
Run full symbol resolution test suite:
```bash
npm test -- symbol_resolution --run
```

Expected: All existing tests pass, no regressions

---

## Acceptance Criteria

- [ ] `build_type_context()` signature updated with `exports` and `definitions` parameters
- [ ] Namespace member resolution uses `exports.get_export_by_name()`
- [ ] `find_export()` and `find_default_export()` use ExportRegistry
- [ ] `resolve_export_chain()` signature updated
- [ ] `build_scope_resolver_index()` signature updated (partial - full in 139.7)
- [ ] All callers updated
- [ ] All tests passing
- [ ] Zero direct `index.exported_symbols` access in migrated functions
- [ ] Documentation updated

---

## Success Metrics

✅ All namespace resolution tests pass
✅ All import resolution tests pass
✅ All export chain tests pass
✅ Zero regressions
✅ Code is cleaner (fewer SemanticIndex dependencies)

---

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.2 (ExportRegistry.get_export_by_name exists)
- ✅ task-epic-11.139.1 (TypeRegistry parameter threading pattern established)

**Enables**:
- Sets pattern for 139.5, 139.6 (threading registries through)
- Partial progress on 139.7 (build_scope_resolver_index signature update)

---

## Risks

### Risk: Too Many Parameter Changes
**Impact**: Many functions need updated signatures, lots of churn
**Mitigation**: Do incrementally, test after each change

### Risk: Test Helper Complexity
**Impact**: `resolve_symbols_with_registries` getting complex
**Mitigation**: Extract sub-helpers if needed, keep it maintainable

### Risk: Missed Callers
**Impact**: Forgot to update a caller of `resolve_export_chain`
**Mitigation**: Use TypeScript compiler errors as guide, they'll catch it

---

## Notes

### Why This Before 139.4-139.7?

**Answer**: It's independent! Can do in parallel with 139.4.

**Order flexibility**:
- 139.1 → 139.2 → 139.3 (Type/Export track)
- 139.4 → 139.5 → 139.6 → 139.7 (Definition/Scope track)

These tracks are independent until 139.7 (when scope_resolver_index needs everything).

---

### Signature Churn is Intentional

Yes, we're adding parameters to many functions. This is **necessary** to:
1. Remove SemanticIndex dependencies
2. Thread registries through call chains
3. Enable future incremental resolution

It will feel like a lot of changes, but each change is mechanical and safe.

---

### Future: Could We Use Dependency Injection?

**Thought**: Instead of threading `exports` and `definitions` through every function, could we bundle them?

```typescript
interface ResolutionContext {
  exports: ExportRegistry
  definitions: DefinitionRegistry
  types: TypeRegistry
  scopes: ScopeRegistry
  indices: ReadonlyMap<FilePath, SemanticIndex>  // For references
}

function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  context: ResolutionContext,
  // ... other params
): SymbolId | null
```

**Consideration**: Would reduce parameter count but adds another abstraction. Save for later refactor if parameter lists get unwieldy.

---

## Timeline

**Day 1 Morning** (2-3 hours):
- Phase 1: Update signatures
- Phase 2: Migrate namespace resolution

**Day 1 Afternoon** (3-4 hours):
- Phase 3: Migrate export chain resolution

**Day 2 Morning** (2-3 hours):
- Phase 4: Update all callers

**Day 2 Afternoon** (2-3 hours):
- Phase 5: Update tests
- Verify all passing

**Total**: 1-2 days depending on test complexity

---

## Completion Checklist

- [ ] Phase 1: Signatures updated
- [ ] Phase 2: Namespace resolution migrated
- [ ] Phase 3: Export chain migrated
- [ ] Phase 4: All callers updated
- [ ] Phase 5: Tests passing
- [ ] No `index.exported_symbols` access in migrated code
- [ ] Documentation updated
- [ ] Code review completed
