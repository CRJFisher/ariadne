# Sub-task 139.8: Update All Tests for Registry Architecture

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 2-3 days

## Overview

Comprehensively update all test files in `resolve_references/` to use the new registry-based architecture. Ensure test coverage is maintained and add new cross-file resolution tests.

**Why needed?**
- ✅ Phases A-C (139.1-139.7) updated implementation
- 🧪 Tests need to match new architecture
- 📊 Verify zero regressions
- ➕ Add tests for new registry capabilities

## Current State

### Tests Updated in Previous Sub-tasks
- ✅ 139.1: `type_context.test.ts` (partial)
- ✅ 139.2: `export_registry.test.ts` (new tests added)
- ✅ 139.3: Some integration tests updated
- ✅ 139.4: `definition_registry.test.ts` (new tests added)
- ✅ 139.5: `scope_resolver_index.test.ts` (partial)
- ✅ 139.6: `import_resolver.test.ts` (partial)
- ✅ 139.7: `scope_resolver_index.test.ts` (final updates)

### Tests Still Needing Updates
Many test files may still have old patterns or incomplete registry usage.

## Scope of Work

### Phase 1: Test Infrastructure (Day 1 AM)

#### Update Test Helpers

**File**: `symbol_resolution.test_helpers.ts`

Current `resolve_symbols_with_registries` may need enhancements:

```typescript
export function resolve_symbols_with_registries(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder
): ResolvedSymbols {
  const definitions = new DefinitionRegistry();
  const types = new TypeRegistry();
  const scopes = new ScopeRegistry();
  const exports = new ExportRegistry();
  const imports = new ImportGraph();

  // Populate all registries from indices
  for (const [file_id, index] of indices) {
    // Definitions
    const all_defs: AnyDefinition[] = [
      ...Array.from(index.functions.values()),
      ...Array.from(index.classes.values()),
      ...Array.from(index.variables.values()),
      ...Array.from(index.interfaces.values()),
      ...Array.from(index.enums.values()),
      ...Array.from(index.namespaces.values()),
      ...Array.from(index.types.values()),
      ...Array.from(index.imported_symbols.values()),
    ];
    definitions.update_file(file_id, all_defs);

    // Types
    const derived = build_derived_data(index);
    types.update_file(file_id, derived);

    // Scopes
    scopes.update_file(file_id, index.scopes);

    // Exports
    const exported_ids = new Set(
      Array.from(derived.exported_symbols.values()).map(def => def.symbol_id)
    );
    exports.update_file(file_id, exported_ids);

    // Imports
    const import_statements = extract_imports_from_imported_symbols(
      index.imported_symbols,
      file_id
    );
    imports.update_file(file_id, import_statements);
  }

  // Call resolve_symbols with all registries
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

**Add additional helpers**:

```typescript
/**
 * Build all registries from semantic indices
 * Useful for tests that need registries but don't call resolve_symbols
 */
export function build_registries_from_indices(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): {
  definitions: DefinitionRegistry
  types: TypeRegistry
  scopes: ScopeRegistry
  exports: ExportRegistry
  imports: ImportGraph
} {
  const definitions = new DefinitionRegistry();
  const types = new TypeRegistry();
  const scopes = new ScopeRegistry();
  const exports = new ExportRegistry();
  const imports = new ImportGraph();

  // ... populate same as above ...

  return { definitions, types, scopes, exports, imports };
}

/**
 * Create empty registries for testing
 */
export function create_empty_registries() {
  return {
    definitions: new DefinitionRegistry(),
    types: new TypeRegistry(),
    scopes: new ScopeRegistry(),
    exports: new ExportRegistry(),
    imports: new ImportGraph(),
  };
}
```

---

### Phase 2: Update Unit Tests (Day 1 PM - Day 2)

#### 2.1: Type Context Tests
**File**: `type_resolution/type_context.test.ts`

**Updates needed**:
- All `build_type_context` calls must pass `exports` and `definitions`
- Use `build_registries_from_indices` helper

**Pattern**:
```typescript
it('should resolve symbol types correctly', () => {
  const indices = new Map([[file_id, index]]);
  const { definitions, types, scopes, exports, imports } = build_registries_from_indices(indices);

  const resolver_index = build_scope_resolver_index(indices, definitions, scopes, exports, root_folder);
  const cache = create_resolution_cache();
  const namespace_sources = build_namespace_sources(indices, root_folder);

  const type_context = build_type_context(
    indices,
    types,
    exports,  // ← NOW REQUIRED
    definitions,  // ← NOW REQUIRED
    resolver_index,
    cache,
    namespace_sources
  );

  // ... assertions ...
});
```

---

#### 2.2: Scope Resolver Tests
**File**: `scope_resolver_index/scope_resolver_index.test.ts`

**Updates needed**:
- All `build_scope_resolver_index` calls must pass all registries
- All `find_local_definitions` direct calls need updating
- All `extract_import_specs` direct calls need updating

**Pattern**:
```typescript
it('should resolve symbols with correct shadowing', () => {
  const indices = new Map([[file_id, index]]);
  const { definitions, scopes, exports } = build_registries_from_indices(indices);

  const resolver_index = build_scope_resolver_index(
    indices,
    definitions,  // ← REQUIRED
    scopes,  // ← REQUIRED
    exports,  // ← REQUIRED
    root_folder
  );

  // ... assertions ...
});
```

---

#### 2.3: Import Resolver Tests
**Files**:
- `import_resolution/import_resolver.test.ts`
- `import_resolution/import_resolver.typescript.test.ts`
- `import_resolution/import_resolver.javascript.test.ts`
- `import_resolution/import_resolver.python.test.ts`
- `import_resolution/import_resolver.rust.test.ts`

**Updates needed**:
- `resolve_export_chain` calls need `exports` and `definitions`
- `extract_import_specs` calls need updated signature
- `find_export` / `find_default_export` if tested directly

---

### Phase 3: Update Integration Tests (Day 2 PM)

#### 3.1: Symbol Resolution Integration Tests
**Files**:
- `symbol_resolution.typescript.test.ts`
- `symbol_resolution.javascript.test.ts`
- `symbol_resolution.python.test.ts`
- `symbol_resolution.rust.test.ts`
- `symbol_resolution.integration.test.ts`
- `symbol_resolution.typescript.namespace_resolution.test.ts`
- `namespace_resolution.test.ts`

**Good news**: Most of these already use `resolve_symbols_with_registries` helper!

**Verification needed**:
- Confirm all use the helper
- Add any missing test coverage
- Ensure no direct SemanticIndex field access in test code

---

### Phase 4: Add New Test Coverage (Day 3 AM)

#### 4.1: Cross-File Resolution Tests

Add tests that verify registries enable cross-file resolution:

**File**: `symbol_resolution.cross_file.test.ts` (new)

```typescript
describe('Cross-File Symbol Resolution', () => {
  it('should resolve imported function across multiple files', () => {
    // File 1: base.ts
    const base = create_test_index('base.ts' as FilePath, {
      functions: [
        function_symbol('core', 'base.ts', {...}, 'scope:base.ts:module'),
      ],
    });

    // File 2: middle.ts (re-exports)
    const middle = create_test_index('middle.ts' as FilePath, {
      imports: [
        import_symbol('core', 'base.ts', 'middle.ts', {...}, 'scope:middle.ts:module'),
      ],
      // Re-export
    });

    // File 3: main.ts (uses re-export)
    const main = create_test_index('main.ts' as FilePath, {
      imports: [
        import_symbol('core', 'middle.ts', 'main.ts', {...}, 'scope:main.ts:module'),
      ],
      references: [
        call_reference('core', 'main.ts', {...}, 'scope:main.ts:module'),
      ],
    });

    const indices = new Map([
      ['base.ts' as FilePath, base],
      ['middle.ts' as FilePath, middle],
      ['main.ts' as FilePath, main],
    ]);

    const root_folder = build_file_tree(['base.ts', 'middle.ts', 'main.ts']);
    const resolved = resolve_symbols_with_registries(indices, root_folder);

    // Verify call in main.ts resolves to function in base.ts
    const call_key = location_key(call_reference_location);
    expect(resolved.resolved_references.get(call_key)).toBe('function:base.ts:core:1:0');
  });

  it('should handle circular dependencies gracefully', () => {
    // File A imports from B, File B imports from A
    // Should not crash, should detect cycle
  });

  it('should resolve namespace member across files', () => {
    // import * as utils from './utils'
    // utils.helper()  → should resolve to function in utils.ts
  });
});
```

---

#### 4.2: Registry Cache Tests

Verify caching behavior works correctly:

**File**: `definition_registry_integration.test.ts` (new)

```typescript
describe('DefinitionRegistry Integration', () => {
  it('should use cached scope queries for performance', () => {
    const file_id = 'large.ts' as FilePath;
    // ... create large index with many scopes ...

    const { definitions } = build_registries_from_indices(indices);

    // First query builds cache
    const start1 = performance.now();
    const defs1 = definitions.get_scope_definitions(scope_id, file_id);
    const time1 = performance.now() - start1;

    // Second query uses cache
    const start2 = performance.now();
    const defs2 = definitions.get_scope_definitions(scope_id, file_id);
    const time2 = performance.now() - start2;

    expect(time2).toBeLessThan(time1 / 10);  // 10x faster
  });

  it('should invalidate cache on update_file', () => {
    // Verify cache invalidation works
  });
});
```

---

### Phase 5: Cleanup and Verification (Day 3 PM)

#### 5.1: Remove Dead Code

Search for old test patterns that are no longer needed:

```bash
# Find tests that might still use old patterns
cd packages/core/src/resolve_references
grep -r "index\.functions" *.test.ts
grep -r "index\.variables" *.test.ts
grep -r "index\.scope_to_definitions" *.test.ts
```

Remove or update any matches.

---

#### 5.2: Run Full Test Suite

```bash
# All resolve_references tests
npm test -- resolve_references --run

# All symbol resolution tests
npm test -- symbol_resolution --run

# All integration tests
npm test -- "src/**/*.test.ts" --run
```

**Acceptance**: 100% tests passing, zero regressions.

---

#### 5.3: Coverage Report

Generate and verify test coverage:

```bash
npm test -- --coverage
```

**Target**: >95% coverage for all modified files.

---

## Test Categories

### Category 1: Pure Unit Tests
**Focus**: Single function testing
**Examples**:
- `get_scope_definitions()` correctness
- `get_export_by_name()` correctness
- `find_local_definitions()` with registries

**Status**: Mostly done in sub-tasks 139.2, 139.4, 139.5, 139.6

---

### Category 2: Integration Tests
**Focus**: Multiple functions working together
**Examples**:
- `build_scope_resolver_index()` → `resolve_function_calls()`
- `build_type_context()` → `resolve_method_calls()`
- Full `resolve_symbols()` pipeline

**Status**: Need verification and possible updates

---

### Category 3: Cross-File Tests
**Focus**: Multi-file scenarios
**Examples**:
- Import chains
- Re-exports
- Namespace member resolution across files

**Status**: Need to add (new tests)

---

### Category 4: Performance Tests
**Focus**: Registry caching and efficiency
**Examples**:
- Scope query caching
- Large file handling
- Incremental updates

**Status**: Need to add (new tests)

---

## Testing Checklist

### Unit Tests
- [ ] All `type_context.test.ts` tests updated and passing
- [ ] All `scope_resolver_index.test.ts` tests updated and passing
- [ ] All `import_resolver*.test.ts` tests updated and passing
- [ ] All registry tests passing (definition, type, scope, export)

### Integration Tests
- [ ] All `symbol_resolution*.test.ts` tests passing
- [ ] All `namespace_resolution.test.ts` tests passing
- [ ] No regressions in any test file

### New Tests
- [ ] Cross-file resolution tests added
- [ ] Registry cache tests added
- [ ] Edge case tests added (circular dependencies, missing files, etc.)

### Coverage
- [ ] >95% coverage on all modified files
- [ ] All new registry methods covered
- [ ] All migration code paths covered

## Acceptance Criteria

- [ ] All existing tests updated to use registries
- [ ] All tests passing (100% pass rate)
- [ ] Test helpers (`resolve_symbols_with_registries`, etc.) complete
- [ ] New cross-file resolution tests added
- [ ] New registry caching tests added
- [ ] No direct SemanticIndex field access in test code (except `.references`, `.language`)
- [ ] Test coverage >95% on modified files
- [ ] Performance tests demonstrate expected improvements

## Success Metrics

✅ 100% test pass rate
✅ Zero regressions from baseline
✅ >95% code coverage
✅ All new registry capabilities tested
✅ Performance improvements verified

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.1-139.7 (all implementation complete)

**Enables**:
- 139.9 (performance benchmarking with verified tests)
- 139.10 (documentation with working examples)

## Risks & Mitigations

### Risk: Massive Test Breakage
**Impact**: Many tests fail, hard to debug
**Mitigation**: Update incrementally by category, fix one category at a time

### Risk: Missing Test Coverage
**Impact**: New code paths not tested
**Mitigation**: Comprehensive checklist above, code coverage reports

### Risk: Flaky Tests
**Impact**: Tests pass/fail inconsistently
**Mitigation**: Performance tests may need threshold adjustments based on CI environment

## Timeline

**Day 1 Morning** (3-4 hours):
- Phase 1: Update test infrastructure and helpers

**Day 1 Afternoon** (4 hours):
- Phase 2.1-2.2: Update type_context and scope_resolver tests

**Day 2** (6-8 hours):
- Phase 2.3: Update import_resolver tests
- Phase 3: Verify integration tests

**Day 3 Morning** (3-4 hours):
- Phase 4: Add new test coverage

**Day 3 Afternoon** (2-3 hours):
- Phase 5: Cleanup and full verification

**Total**: 2-3 days

## Notes

### Why This Is a Separate Sub-task

Tests are substantial enough to warrant their own sub-task:
- Many test files need updates
- New test categories to add
- Verification step for entire Phase A-C work
- Natural checkpoint before performance and documentation

### Test-Driven Refactoring

This sub-task validates that Phases A-C were successful. If tests reveal issues, we may need to revisit earlier sub-tasks. That's expected and healthy!

### Helper Functions Are Key

Good test helpers make all the difference:
- `resolve_symbols_with_registries` → Used by 90% of tests
- `build_registries_from_indices` → Used by remaining 10%
- Updating these helpers updates most tests automatically
