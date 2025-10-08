# Task: Implement Cross-File Import Resolution

**Epic**: 11 - Codebase Restructuring
**Status**: TODO
**Priority**: High
**Estimated Effort**: 3-5 days

## Context

Currently, ~20 symbol resolution integration tests are marked as `.todo()` because they require cross-file import resolution. The symbol resolution system can resolve symbols within a single file, but cannot follow imports to find definitions in other files.

### Current State

The infrastructure exists:
- ✅ `ImportResolver` with language-specific module path resolution
- ✅ `FileSystemFolder` tree for file existence checking
- ✅ `resolve_export_chain()` for following re-exports
- ✅ `build_scope_resolver_index()` creates resolver functions per file
- ✅ Import definitions extracted during semantic indexing

### Missing Pieces

Import resolver functions are created but don't actually resolve cross-file:
1. When resolving a symbol name in a scope, check if it's an import
2. If import found, use `resolve_export_chain()` to find the actual definition
3. Cache the result for O(1) future lookups

## Affected Test Files

### TypeScript (8 .todo tests)
- `symbol_resolution.typescript.test.ts`
  - Imported class constructor resolution
  - Imported function calls
  - Method calls on imported classes
  - Interface implementation across files
  - Generic type resolution with imports

### Python (8 .todo tests)
- `symbol_resolution.python.test.ts`
  - `from module import func` resolution
  - Relative imports (`.helper`, `..parent`)
  - Package imports (`package.module.func`)
  - Class imports with method calls
  - Decorator resolution from imports

### Rust (12 .todo tests)
- `symbol_resolution.rust.test.ts`
  - `use crate::utils::func` resolution
  - `use super::parent::Type` resolution
  - `use self::module::func` resolution
  - Trait imports and implementations
  - Module file vs directory resolution
  - Nested module resolution

## Implementation Plan

### Phase 1: Update Import Resolvers (1 day)

**File**: `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`

Update the `create_import_resolvers()` function to actually call `resolve_export_chain()`:

```typescript
function create_import_resolvers(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder
): Map<SymbolName, ResolverFunction> {
  const resolvers = new Map<SymbolName, ResolverFunction>();

  for (const import_spec of extract_import_specs(scope_id, index, file_path, root_folder)) {
    const resolver: ResolverFunction = (cache) => {
      // Check cache first
      const cache_key = `${scope_id}:${import_spec.local_name}`;
      const cached = cache.get(cache_key);
      if (cached !== undefined) return cached;

      // Resolve the export chain
      const resolved = resolve_export_chain(
        import_spec.source_file,
        import_spec.import_name,
        indices,
        root_folder,
        import_spec.import_kind
      );

      // Cache and return
      cache.set(cache_key, resolved);
      return resolved;
    };

    resolvers.set(import_spec.local_name, resolver);
  }

  return resolvers;
}
```

### Phase 2: Fix JavaScript Tests (0.5 days)

**File**: `symbol_resolution.javascript.test.ts`

Remove `.todo()` from tests and verify they pass:
- Import function call resolution
- Import class constructor resolution
- Import default exports
- Import namespace resolution

### Phase 3: Fix TypeScript Tests (1 day)

**File**: `symbol_resolution.typescript.test.ts`

Remove `.todo()` from 8 tests:
1. "resolves imported function call"
2. "resolves imported class constructor"
3. "resolves method call on imported class"
4. "resolves interface method across files"
5. "resolves generic class across files"
6. "resolves type alias imports"
7. "resolves enum imports"
8. "resolves namespace imports"

### Phase 4: Fix Python Tests (1 day)

**File**: `symbol_resolution.python.test.ts`

Remove `.todo()` from 8 tests:
1. "resolves imported function (from...import)"
2. "resolves relative import (from . import)"
3. "resolves parent import (from .. import)"
4. "resolves package import (from pkg.mod import)"
5. "resolves class import with method call"
6. "resolves decorator from import"
7. "resolves * import (import all)"
8. "resolves class constructor from import"

### Phase 5: Fix Rust Tests (1.5 days)

**File**: `symbol_resolution.rust.test.ts`

Remove `.todo()` from 12 tests:
1. "resolves imported function call (use statement)"
2. "resolves fully qualified function call"
3. "resolves crate:: absolute path"
4. "resolves super:: relative path"
5. "resolves self:: current module"
6. "resolves module file (utils.rs)"
7. "resolves module directory (utils/mod.rs)"
8. "resolves nested modules"
9. "resolves trait imports"
10. "resolves trait method call"
11. "resolves default trait implementation"
12. "resolves associated function (::new)"

### Phase 6: Integration Testing (0.5 days)

Run full test suite to ensure:
- No regressions in existing tests
- Cache hit rates are good (>80%)
- Performance is acceptable
- All `.todo()` tests for cross-file imports are now passing

## Acceptance Criteria

- [ ] All 28 cross-file import resolution tests pass (no more `.todo()`)
- [ ] Cache hit rate >80% for repeated import references
- [ ] No performance regressions (resolution < 100ms for typical files)
- [ ] All existing tests still pass
- [ ] Documentation updated with cross-file resolution flow

## Dependencies

None - all infrastructure is already implemented.

## Testing Strategy

1. Unit tests for `create_import_resolvers()` function
2. Integration tests verify cross-file resolution works
3. Performance benchmarks for cache effectiveness
4. Edge case testing:
   - Circular imports (should handle gracefully)
   - Missing files (should return null)
   - Re-export chains (should follow correctly)

## Notes

- JavaScript tests already pass because JavaScript has simpler module rules
- Focus on TypeScript, Python, and Rust which have more complex import semantics
- The `.todo()` tests are well-structured and should pass once resolver is fixed
