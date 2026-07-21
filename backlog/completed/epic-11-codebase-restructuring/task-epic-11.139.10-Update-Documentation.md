# Sub-task 139.10: Update Documentation

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: Medium
**Complexity**: Low
**Estimated Effort**: 0.5 day

## Overview

Update all documentation to reflect the registry-based architecture, including README files, JSDoc comments, architecture docs, and migration guides.

**Why needed?**
- ✅ Document architectural changes for future maintainers
- 📚 Update API documentation to reflect new signatures
- 🗺️ Provide migration guide for future registry additions
- 🎯 Complete Phase 2 with comprehensive documentation

## Scope of Work

### 1. Update JSDoc Comments (Morning)

#### resolve_symbols() Function
**File**: `symbol_resolution.ts`

Update JSDoc to document registry parameters:

```typescript
/**
 * Resolve all symbol references across multiple files
 *
 * Main entry point for cross-file symbol resolution. Integrates with Project
 * coordination layer through registry parameters.
 *
 * Architecture:
 * - Phase 1: build_scope_resolver_index - Creates on-demand resolvers
 * - Phase 2: create_resolution_cache - Shared cache for all resolutions
 * - Phase 3: build_namespace_sources - Maps namespace imports to files
 * - Phase 4: build_type_context - Type tracking and member resolution
 * - Phase 5: resolve_function_calls, resolve_method_calls, resolve_constructor_calls
 * - Phase 6: combine_results - Merge all resolutions
 *
 * Registry Integration:
 * - DefinitionRegistry: Provides scope-based definition queries
 * - TypeRegistry: Provides type bindings and member information
 * - ScopeRegistry: Provides scope tree traversal
 * - ExportRegistry: Provides export lookup by name
 * - ImportGraph: Tracks import dependencies
 *
 * @param indices - Map of file_path → SemanticIndex for all files.
 *                  Used for .references (not in registries) and .language metadata.
 * @param definitions - Project-level registry of all definitions (from Project coordinator)
 * @param types - Project-level registry of type information (from Project coordinator)
 * @param scopes - Project-level registry of scope trees (from Project coordinator)
 * @param exports - Project-level registry of exported symbols (from Project coordinator)
 * @param imports - Project-level import dependency graph (from Project coordinator)
 * @param root_folder - Root of the file system tree for import resolution
 *
 * @returns ResolvedSymbols containing:
 *          - resolved_references: Map of reference location → resolved symbol_id
 *          - references_to_symbol: Reverse map of symbol_id → all reference locations
 *          - references: All call references
 *          - definitions: All callable definitions
 *
 * @example
 * ```typescript
 * // Called from Project coordinator
 * const resolved = resolve_symbols(
 *   project.semantic_indexes,
 *   project.definitions,
 *   project.types,
 *   project.scopes,
 *   project.exports,
 *   project.imports,
 *   root_folder
 * );
 * ```
 */
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  scopes: ScopeRegistry,
  exports: ExportRegistry,
  imports: ImportGraph,
  root_folder: FileSystemFolder
): ResolvedSymbols
```

#### Other Functions

Update JSDoc for:
- `build_scope_resolver_index()`
- `build_type_context()`
- `find_local_definitions()`
- `extract_import_specs()`
- All registry methods (`get_scope_definitions`, `get_export_by_name`, etc.)

---

### 2. Update README Files (Morning)

#### Main Package README
**File**: `packages/core/README.md`

Add section on registry architecture:

```markdown
## Architecture: Registry-Based Symbol Resolution

As of task-epic-11.139, Ariadne uses a **registry-based architecture** for symbol resolution.

### Registries

Registries are project-level data stores managed by the `Project` coordinator:

- **DefinitionRegistry**: Stores all definitions (functions, classes, variables, imports, etc.)
  - Provides O(1) scope-based queries via lazy caching
  - Key method: `get_scope_definitions(scope_id, file_id, kind?)`

- **TypeRegistry**: Stores type bindings and member information
  - Provides type information for variables, parameters, return types
  - Key methods: `get_type_binding()`, `get_type_members()`

- **ScopeRegistry**: Stores scope trees for all files
  - Provides scope traversal and hierarchy queries
  - Key methods: `get_scope()`, `get_file_root_scope()`

- **ExportRegistry**: Stores exported symbol IDs
  - Provides export lookup by name
  - Key method: `get_export_by_name(file_id, name, definitions)`

- **ImportGraph**: Tracks import dependencies between files
  - Enables dependency analysis and incremental resolution
  - Key methods: `get_dependencies()`, `get_dependents()`

### Symbol Resolution Pipeline

```
Project
  ├─> Registries (DefinitionRegistry, TypeRegistry, etc.)
  ├─> semantic_indexes (Map<FilePath, SemanticIndex>)
  └─> resolve_symbols(indices, registries...) → ResolvedSymbols
        ├─> build_scope_resolver_index (uses DefinitionRegistry, ScopeRegistry, ExportRegistry)
        ├─> build_type_context (uses TypeRegistry, ExportRegistry)
        └─> resolve_*_calls (uses ScopeResolverIndex, TypeContext)
```

### Why Registries?

Benefits:
- **Separation of concerns**: Project coordinator owns data, resolution functions query it
- **Incremental updates**: Can invalidate and re-resolve only changed files
- **Better caching**: Registries cache derived data (scope→definitions, name→export)
- **Testability**: Easier to test resolution functions with mock registries

Trade-offs:
- **More parameters**: Functions now accept multiple registry parameters
- **Slight complexity**: Need to understand registry APIs
- **Small memory overhead**: Registries cache data (~10-20% increase)

### Migration from SemanticIndex-Based

Previous architecture (Phase 1):
- `resolve_symbols` accessed `index.functions`, `index.scopes`, etc. directly
- Data scattered across SemanticIndex objects
- No cross-file caching

Current architecture (Phase 2):
- `resolve_symbols` queries registries via clean APIs
- Data centralized in Project coordinator
- Efficient caching enables incremental resolution

Only `index.references` and `index.language` are still accessed directly (intentional).
```

---

#### Resolve References README
**File**: `packages/core/src/resolve_references/README.md`

Update or create README documenting the resolution pipeline:

```markdown
# Symbol Resolution

## Overview

This module resolves symbol references to their definitions across multiple files.

## Architecture

### Input: Semantic Indices + Registries

- `indices`: Map<FilePath, SemanticIndex> - Contains references and metadata
- `definitions`: DefinitionRegistry - All definitions in project
- `types`: TypeRegistry - Type bindings and members
- `scopes`: ScopeRegistry - Scope trees
- `exports`: ExportRegistry - Exported symbols
- `imports`: ImportGraph - Import dependencies

### Output: ResolvedSymbols

- `resolved_references`: Map<LocationKey, SymbolId> - What each reference points to
- `references_to_symbol`: Map<SymbolId, Location[]> - Reverse index
- `references`: CallReference[] - All call references
- `definitions`: Map<SymbolId, AnyDefinition> - All callable definitions

### Pipeline Phases

1. **build_scope_resolver_index** - Create resolvers for every symbol in every scope
   - Queries: `definitions.get_scope_definitions()`, `scopes.get_scope()`
   - Output: ScopeResolverIndex with on-demand resolution

2. **build_namespace_sources** - Map namespace imports to their source files
   - Queries: `definitions.get_scope_definitions(scope_id, file_id, "import")`
   - Output: Map<SymbolId, FilePath>

3. **build_type_context** - Track types and members
   - Queries: `types.get_type_binding()`, `types.get_type_members()`, `exports.get_export_by_name()`
   - Output: TypeContext with type/member lookup

4. **resolve_function_calls** - Resolve function calls
   - Uses: ScopeResolverIndex
   - Output: Map<LocationKey, SymbolId>

5. **resolve_method_calls** - Resolve method calls
   - Uses: ScopeResolverIndex, TypeContext
   - Output: Map<LocationKey, SymbolId>

6. **resolve_constructor_calls** - Resolve constructor calls
   - Uses: ScopeResolverIndex, TypeContext
   - Output: Map<LocationKey, SymbolId>

7. **combine_results** - Merge all resolutions
   - Input: All resolution maps
   - Output: ResolvedSymbols

## Key Concepts

### On-Demand Resolution

Resolvers are closures created during index building but only executed when needed:

```typescript
// Create resolver (cheap)
const resolver = () => resolve_export_chain(source, name, ...);

// Execute resolver (expensive, but cached)
const symbol_id = resolver();
```

### Shadowing

Child scopes override parent scopes:
- Local definitions shadow imports
- Imports shadow parent scope symbols

### Import Chain Following

Re-exports are followed recursively with cycle detection:
```
base.ts: export function foo() {}
middle.ts: export { foo } from './base'
main.ts: import { foo } from './middle'  ← Resolves to base.ts
```

## Testing

See `symbol_resolution.test_helpers.ts` for test utilities:
- `resolve_symbols_with_registries()` - Main test helper
- `build_registries_from_indices()` - Create registries for testing
- `create_test_index()` - Create semantic index fixtures

## Performance

- First resolution per file builds caches
- Subsequent resolutions are very fast
- See PERFORMANCE_REPORT.md for benchmarks
```

---

### 3. Add Migration Guide (Afternoon)

**File**: `REGISTRY_MIGRATION_GUIDE.md` (new)

```markdown
# Registry Migration Guide

Guide for migrating resolve_symbols sub-functions to use Project registries.

## When to Use This Guide

- Adding new resolution types (e.g., decorators, macros)
- Refactoring existing resolution code
- Adding new registry types

## Pattern: Adding a New Registry

### Step 1: Define Registry Interface

```typescript
// packages/core/src/project/my_registry.ts
export class MyRegistry {
  private data: Map<FilePath, MyData> = new Map();

  update_file(file_id: FilePath, data: MyData): void {
    this.data.set(file_id, data);
  }

  get_data(file_id: FilePath): MyData | undefined {
    return this.data.get(file_id);
  }
}
```

### Step 2: Integrate with Project

```typescript
// packages/core/src/project/project.ts
export class Project {
  private my_registry: MyRegistry = new MyRegistry();

  index_file(file_path: FilePath, source: string): void {
    // ... build semantic index ...

    // Update new registry
    const my_data = extract_my_data(index);
    this.my_registry.update_file(file_path, my_data);
  }
}
```

### Step 3: Thread Through resolve_symbols

```typescript
// packages/core/src/resolve_references/symbol_resolution.ts
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  // ... existing registries ...
  myRegistry: MyRegistry,  // ← ADD
  root_folder: FileSystemFolder
): ResolvedSymbols {
  // ... pass to sub-functions as needed ...
}
```

### Step 4: Update Tests

```typescript
// Update test helper
export function resolve_symbols_with_registries(...): ResolvedSymbols {
  // ... existing registries ...
  const myRegistry = new MyRegistry();

  // Populate from indices
  for (const [file_id, index] of indices) {
    const my_data = extract_my_data(index);
    myRegistry.update_file(file_id, my_data);
  }

  return resolve_symbols(
    indices,
    definitions,
    // ...
    myRegistry,
    root_folder
  );
}
```

## Pattern: Adding Caching to Registry

### Lazy Cache (Recommended)

```typescript
export class CachingRegistry {
  private data: Map<FilePath, Data> = new Map();
  private cache: Map<FilePath, DerivedData> = new Map();  // ← Cache

  update_file(file_id: FilePath, data: Data): void {
    this.data.set(file_id, data);
    this.cache.delete(file_id);  // ← Invalidate
  }

  get_derived(file_id: FilePath): DerivedData {
    // Check cache
    if (!this.cache.has(file_id)) {
      // Build cache on first access
      const data = this.data.get(file_id);
      const derived = compute_derived(data);
      this.cache.set(file_id, derived);
    }

    return this.cache.get(file_id)!;
  }
}
```

**When to use**:
- Derived data is expensive to compute
- Not all files will be queried
- Memory usage is a concern

### Eager Cache

```typescript
export class EagerRegistry {
  private data: Map<FilePath, Data> = new Map();
  private cache: Map<FilePath, DerivedData> = new Map();

  update_file(file_id: FilePath, data: Data): void {
    this.data.set(file_id, data);

    // Rebuild cache immediately
    const derived = compute_derived(data);
    this.cache.set(file_id, derived);
  }

  get_derived(file_id: FilePath): DerivedData {
    return this.cache.get(file_id)!;  // Always populated
  }
}
```

**When to use**:
- All files will be queried eventually
- Computation is fast
- Consistent performance is important

## Pattern: Registry with Dependencies

Some registries depend on others:

```typescript
export class DependentRegistry {
  get_data(
    file_id: FilePath,
    other_registry: OtherRegistry  // ← Inject dependency
  ): Data {
    const other_data = other_registry.get_data(file_id);
    return combine(this.data, other_data);
  }
}
```

**When to inject**:
- Keeps registries independent
- Easier to test
- More flexible

**When to store reference**:
- Dependency is always needed
- Simpler API (fewer parameters)

**Recommendation**: Inject unless dependency is truly fundamental.

## Common Pitfalls

### ❌ Don't Store SemanticIndex References

```typescript
// BAD
class MyRegistry {
  private indices: Map<FilePath, SemanticIndex>  // ❌ Don't do this

  get_data(file_id: FilePath): Data {
    return this.indices.get(file_id).some_field;  // ❌ Defeats purpose of registries
  }
}
```

**Why**: Registries should own their data, not reference SemanticIndex.

### ❌ Don't Duplicate Data

```typescript
// BAD
class MyRegistry {
  private definitions: Map<SymbolId, AnyDefinition>  // ❌ DefinitionRegistry already has this
}
```

**Why**: Data duplication → synchronization bugs, memory waste.

### ❌ Don't Skip Cache Invalidation

```typescript
// BAD
update_file(file_id: FilePath, data: Data): void {
  this.data.set(file_id, data);
  // ❌ Forgot to invalidate cache!
  // this.cache.delete(file_id);  ← Missing!
}
```

**Why**: Stale cache → wrong results.

## Testing Registries

### Unit Tests

Test registry methods in isolation:

```typescript
describe('MyRegistry', () => {
  it('should store and retrieve data', () => {
    const registry = new MyRegistry();
    registry.update_file(file_id, data);
    expect(registry.get_data(file_id)).toEqual(data);
  });

  it('should invalidate cache on update', () => {
    const registry = new MyRegistry();
    registry.get_derived(file_id);  // Build cache
    expect(registry.has_cache(file_id)).toBe(true);

    registry.update_file(file_id, new_data);
    expect(registry.has_cache(file_id)).toBe(false);  // Cache invalidated
  });
});
```

### Integration Tests

Test registry with resolve_symbols:

```typescript
it('should resolve symbols using new registry', () => {
  const indices = /* ... */;
  const resolved = resolve_symbols_with_registries(indices, root_folder);

  // Verify resolution works end-to-end
  expect(resolved.resolved_references.get(location_key)).toBe(symbol_id);
});
```

## Performance Considerations

- **Lazy cache**: First query slow, subsequent fast
- **Eager cache**: All queries fast, updates slower
- **No cache**: Consistent but may be slow

**Profile first, optimize second!**

## Questions?

See:
- PHASE_2_INVESTIGATION_SUMMARY.md - Detailed analysis
- MIGRATION_ANALYSIS_resolve_symbols_registries.md - Technical deep dive
- task-epic-11.139*.md - Step-by-step implementation
```

---

### 4. Update Architecture Diagrams (If They Exist)

If there are architecture diagrams, update them to show:
- Project coordinator owns registries
- resolve_symbols queries registries
- Data flow from SemanticIndex → Registries → resolve_symbols

---

## Acceptance Criteria

- [ ] All JSDoc comments updated with registry parameters
- [ ] Main README updated with registry architecture section
- [ ] Resolve references README created/updated
- [ ] Registry migration guide created
- [ ] All function signatures documented
- [ ] Examples added to documentation
- [ ] Architecture diagrams updated (if applicable)
- [ ] No references to old SemanticIndex-based architecture

## Success Metrics

✅ Documentation is clear and comprehensive
✅ Future developers can understand registry architecture
✅ Migration guide enables adding new registries
✅ All public APIs documented

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.1-139.9 (all implementation and testing complete)

**Enables**:
- Future developers can maintain and extend the system
- External contributors can understand the architecture

## Timeline

**Morning** (3-4 hours):
- Update JSDoc comments
- Update README files

**Afternoon** (2-3 hours):
- Create migration guide
- Review and polish all documentation

**Total**: 0.5 day

## Notes

### Documentation Is Not Optional

Good documentation is as important as good code:
- Future you will thank present you
- Team members can onboard faster
- External contributors can participate
- Architecture decisions are preserved

### Keep It Updated

Documentation should be updated alongside code:
- When signatures change → update JSDoc
- When architecture evolves → update README
- When patterns emerge → update guides

### Examples Matter

Show, don't just tell:
- Include code examples in JSDoc
- Show before/after in migration guide
- Provide test examples

## Completion

After this sub-task:
- ✅ Task 139 complete
- ✅ Phase 2 complete
- ✅ Registry-based architecture fully documented
- ✅ System is production-ready
- ✅ Future work can build on this foundation

**Congratulations!** 🎉
