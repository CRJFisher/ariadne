# Task: Update resolve_symbols to Accept Registries

**Parent Task**: task-epic-11.138 - Implement Project Coordination Layer
**Status**: Partially Complete (Signature Updated, Implementation Pending)
**Priority**: High
**Complexity**: Medium-High

## Overview

Refactor the `resolve_symbols()` function to accept project-level registries instead of accessing SemanticIndex fields directly. This enables cross-file resolution and completes the integration with the Project coordination layer.

## Goals

1. Update `resolve_symbols()` signature to accept registries
2. Replace direct SemanticIndex field access with registry queries
3. Enable cross-file symbol resolution via DefinitionRegistry
4. Update all call sites and tests
5. Remove temporary `build_derived_data()` calls from resolve_symbols

## Current State

Currently, `resolve_symbols()` likely has a signature like:

```typescript
export function resolve_symbols(
  semantic_index: SemanticIndex,
  // ... possibly other params
): Map<ReferenceId, SymbolId>
```

And accesses fields like:
- `semantic_index.type_bindings`
- `semantic_index.type_members`
- `semantic_index.scope_to_definitions`
- etc.

## Detailed Implementation Plan

### Step 1: Update resolve_symbols Signature

**File**: `packages/core/src/resolve_references/symbol_resolution.ts`

**Old signature**:
```typescript
export function resolve_symbols(
  semantic_index: SemanticIndex
): Map<ReferenceId, SymbolId>
```

**New signature**:
```typescript
import type { DefinitionRegistry } from '../project/definition_registry'
import type { TypeRegistry } from '../project/type_registry'
import type { ScopeRegistry } from '../project/scope_registry'
import type { ExportRegistry } from '../project/export_registry'
import type { ImportGraph } from '../project/import_graph'

export function resolve_symbols(
  semantic_index: SemanticIndex,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  scopes: ScopeRegistry,
  exports: ExportRegistry,
  imports: ImportGraph
): Map<ReferenceId, SymbolId>
```

### Step 2: Replace Field Access with Registry Queries

**Example transformations**:

**Before** (accessing SemanticIndex fields):
```typescript
function resolve_variable_reference(ref: Reference): SymbolId | undefined {
  // Look up in scope_to_definitions
  const scope_defs = semantic_index.scope_to_definitions.get(ref.scope_id)
  if (scope_defs) {
    // Find matching definition
    for (const symbol_id of scope_defs) {
      const def = semantic_index.definitions.find(d => d.symbol_id === symbol_id)
      if (def && def.name === ref.name) {
        return symbol_id
      }
    }
  }
  return undefined
}
```

**After** (using registries):
```typescript
function resolve_variable_reference(
  ref: Reference,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry
): SymbolId | undefined {
  // Get scope chain from innermost to outermost
  const scope_chain = scopes.get_enclosing_scopes(ref.file_id, ref.location)

  // Walk up scope chain looking for matching definition
  for (const scope of scope_chain) {
    // Get all definitions in this scope
    const file_defs = definitions.get_file_definitions(ref.file_id)

    for (const def of file_defs) {
      if (def.scope_id === scope.scope_id && def.name === ref.name) {
        return def.symbol_id
      }
    }
  }

  return undefined
}
```

**For cross-file resolution** (imports):
```typescript
function resolve_imported_reference(
  ref: Reference,
  definitions: DefinitionRegistry,
  exports: ExportRegistry,
  imports: ImportGraph
): SymbolId | undefined {
  // Find import statement that brought this symbol into scope
  const semantic_index_for_file = /* get from context */
  const matching_import = semantic_index_for_file.imports.find(
    imp => imp.imported_symbols?.some(s => s.name === ref.name || s.alias === ref.name)
  )

  if (!matching_import || !matching_import.source_file) {
    return undefined
  }

  const source_file = matching_import.source_file

  // Get exports from source file
  const exported_symbols = exports.get_exports(source_file)

  // Find matching exported symbol
  for (const exported_symbol_id of exported_symbols) {
    const def = definitions.get(exported_symbol_id)
    if (def && def.name === ref.name) {
      return exported_symbol_id
    }
  }

  return undefined
}
```

### Step 3: Update Type Resolution Logic

**Before**:
```typescript
const type_info = semantic_index.type_bindings.get(symbol_id)
const members = semantic_index.type_members.get(type_id)
```

**After**:
```typescript
const type_info = types.get_type_binding(symbol_id)
const members = types.get_type_members(type_id)
```

### Step 4: Remove Temporary build_derived_data Calls

If `resolve_symbols` currently calls `build_derived_data()` internally (added in sub-task 138.1), remove those calls since registries are now passed in.

### Step 5: Update All Call Sites

**In Project.resolve_file()** (already updated in sub-task 138.8):
```typescript
const resolved = resolve_symbols(
  semantic_index,
  this.definitions,
  this.types,
  this.scopes,
  this.exports,
  this.imports
)
```

**In existing tests**:
```typescript
// Before
const resolved = resolve_symbols(semantic_index)

// After
const project = new Project()
project.update_file(file_id, code)
project.resolve_file(file_id)
const resolved = project.get_file_resolutions(file_id)
```

Or, if testing `resolve_symbols` directly:
```typescript
const definitions = new DefinitionRegistry()
const types = new TypeRegistry()
const scopes = new ScopeRegistry()
const exports = new ExportRegistry()
const imports = new ImportGraph()

// Populate registries
definitions.update_file(file_id, semantic_index.definitions)
types.update_file(file_id, derived_data)
scopes.update_file(file_id, semantic_index.scopes)
// etc.

const resolved = resolve_symbols(
  semantic_index,
  definitions,
  types,
  scopes,
  exports,
  imports
)
```

### Step 6: Update Tests

**Files to update**:
- `packages/core/src/resolve_references/symbol_resolution.typescript.test.ts`
- Any other test files that call `resolve_symbols()`

**Strategy**:
1. Create helper function to set up registries for testing:

```typescript
function create_test_project(code: string, file_id: FileId) {
  const semantic_index = build_semantic_index(file_id, code)
  const derived = build_derived_data(semantic_index)

  const definitions = new DefinitionRegistry()
  const types = new TypeRegistry()
  const scopes = new ScopeRegistry()
  const exports = new ExportRegistry()
  const imports = new ImportGraph()

  definitions.update_file(file_id, semantic_index.definitions)
  types.update_file(file_id, derived)
  scopes.update_file(file_id, semantic_index.scopes)
  exports.update_file(file_id, derived.exported_symbols)
  imports.update_file(file_id, semantic_index.imports)

  return {
    semantic_index,
    derived,
    definitions,
    types,
    scopes,
    exports,
    imports
  }
}
```

2. Update test cases to use the helper:

```typescript
it('should resolve function call reference', () => {
  const file1 = file_id('file1.ts')
  const code = `
    function foo() { return 42 }
    const x = foo()
  `

  const { semantic_index, definitions, types, scopes, exports, imports } =
    create_test_project(code, file1)

  const resolved = resolve_symbols(
    semantic_index,
    definitions,
    types,
    scopes,
    exports,
    imports
  )

  // Find reference to 'foo' in the call
  const foo_ref = semantic_index.references.find(
    r => r.name === 'foo' && r.reference_type === 'call'
  )

  expect(resolved.get(foo_ref!.reference_id)).toBeDefined()
})
```

### Step 7: Add Cross-File Resolution Tests

Add new tests that validate cross-file resolution:

```typescript
describe('cross-file resolution', () => {
  it('should resolve imported function', () => {
    const file1 = file_id('lib.ts')
    const file2 = file_id('main.ts')

    // lib.ts: export function foo() {}
    const lib_code = 'export function foo() { return 42 }'

    // main.ts: import { foo } from './lib'; foo()
    const main_code = `
      import { foo } from './lib'
      const x = foo()
    `

    const definitions = new DefinitionRegistry()
    const types = new TypeRegistry()
    const scopes = new ScopeRegistry()
    const exports = new ExportRegistry()
    const imports = new ImportGraph()

    // Index lib.ts
    const lib_index = build_semantic_index(file1, lib_code)
    const lib_derived = build_derived_data(lib_index)
    definitions.update_file(file1, lib_index.definitions)
    exports.update_file(file1, lib_derived.exported_symbols)

    // Index main.ts
    const main_index = build_semantic_index(file2, main_code)
    const main_derived = build_derived_data(main_index)
    definitions.update_file(file2, main_index.definitions)
    scopes.update_file(file2, main_index.scopes)
    imports.update_file(file2, main_index.imports)

    // Resolve main.ts
    const resolved = resolve_symbols(
      main_index,
      definitions,
      types,
      scopes,
      exports,
      imports
    )

    // Find reference to 'foo' in main.ts
    const foo_ref = main_index.references.find(r => r.name === 'foo')

    // Should resolve to foo from lib.ts
    const resolved_symbol = resolved.get(foo_ref!.reference_id)
    expect(resolved_symbol).toBeDefined()

    const foo_def = definitions.get(resolved_symbol!)
    expect(foo_def!.name).toBe('foo')
    expect(foo_def!.location.file).toBe(file1)
  })
})
```

## Acceptance Criteria

- [x] `resolve_symbols()` signature updated to accept registries
- [ ] All direct SemanticIndex field access replaced with registry queries
- [ ] Cross-file resolution implemented (imports)
- [ ] All call sites updated (only Project coordinator call site exists)
- [x] All tests updated to use new signature
- [ ] New cross-file resolution tests added
- [x] All existing tests still pass (3 pre-existing namespace resolution failures)
- [x] No regression in symbol resolution accuracy

## Dependencies

- Sub-tasks 138.1-138.7 (all registries)
- Sub-task 138.8 (Project coordinator)

## Estimated Effort

- Implementation: 5-6 hours
- Testing: 4-5 hours
- Total: 9-11 hours

## Notes

- This is a significant refactoring that touches many files
- Cross-file resolution is a major new capability
- Take care to preserve existing resolution logic behavior
- Test thoroughly with both single-file and multi-file scenarios
- Consider adding debug logging to help troubleshoot resolution issues

## Implementation Notes

### Phase 1: Signature and Test Updates (Completed)

**Date**: 2025-10-10

**What was completed**:

1. **Updated `resolve_symbols()` signature** in `symbol_resolution.ts`:
   - Added 5 registry parameters: `definitions`, `types`, `scopes`, `exports`, `imports`
   - Kept `indices` parameter (Map<FilePath, SemanticIndex>)
   - Kept `root_folder` parameter
   - Added proper imports for all registry types

2. **Created test helper function** in `symbol_resolution.test_helpers.ts`:
   - Created `resolve_symbols_with_registries()` helper
   - Helper creates all 5 registry instances
   - Populates registries from semantic indices
   - Provides backward compatibility for existing tests
   - Fixed TypeScript compilation errors with proper type annotations

3. **Updated all test files** (7 files total):
   - `symbol_resolution.typescript.test.ts`
   - `symbol_resolution.javascript.test.ts`
   - `symbol_resolution.python.test.ts`
   - `symbol_resolution.rust.test.ts`
   - `symbol_resolution.integration.test.ts`
   - `symbol_resolution.typescript.namespace_resolution.test.ts`
   - `namespace_resolution.test.ts`
   - All tests now use `resolve_symbols_with_registries()` instead of direct `resolve_symbols()` calls

**Current test status**:
- ✅ **Zero TypeScript compilation errors**
- ✅ **1226 tests passing** (+ 90 skipped, 33 todo)
- ❌ **3 tests failing** (pre-existing namespace resolution issues, unrelated to this refactoring)
  - `namespace_resolution.test.ts:215` - resolves function call on namespace import
  - `namespace_resolution.test.ts:394` - resolves class constructor on namespace import
  - `namespace_resolution.test.ts:653` - resolves multiple members on same namespace

**What remains incomplete**:

The function signature was updated but **the implementation was NOT refactored**. This is a transitional state:

1. **Registry parameters are unused**: The 5 registries are passed in but never called
2. **Still builds derived data internally**: Lines still create `derived_data_map` from scratch
3. **Still accesses SemanticIndex fields directly**: Code still uses `index.references`, `index.functions`, `index.classes`, etc.
4. **No registry method calls**: Zero calls to `definitions.get()`, `types.get_type_binding()`, `scopes.get_enclosing_scopes()`, etc.

**Code snippet showing transitional state**:
```typescript
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  scopes: ScopeRegistry,
  exports: ExportRegistry,
  imports: ImportGraph,
  root_folder: FileSystemFolder
): ResolvedSymbols {
  // Phase 0: Build derived data for all indices (TEMPORARY)
  // TODO: Refactor sub-functions (build_scope_resolver_index, build_type_context)
  // to use registries directly instead of derived_data_map
  // For now, we still build derived data locally for backwards compatibility
  const derived_data_map = new Map();
  for (const [file_path, index] of indices) {
    derived_data_map.set(file_path, build_derived_data(index));
  }
  // ... rest still uses old approach
```

### Phase 2: Implementation Refactoring (Next Steps)

**To complete this task, the following work is needed**:

1. **Refactor sub-functions** to accept and use registries:
   - `build_scope_resolver_index()` - should use `scopes` registry
   - `build_type_context()` - should use `types` registry
   - `combine_results()` - should use `definitions` registry

2. **Remove internal `derived_data_map` building**:
   - Delete the Phase 0 section that builds derived_data_map
   - Remove all calls to `build_derived_data()`

3. **Replace all SemanticIndex field access** with registry queries:
   - `index.type_bindings` → `types.get_type_binding()`
   - `index.type_members` → `types.get_type_members()`
   - `index.scope_to_definitions` → `scopes.get_enclosing_scopes()` + `definitions.get_file_definitions()`
   - etc.

4. **Eventually remove `indices` parameter**: Once all data comes from registries, the `indices` Map may no longer be needed

5. **Add cross-file resolution tests**: Test that imports can resolve to definitions in other files

**Estimated effort for Phase 2**: 4-6 hours

**Files modified**:
- `packages/core/src/resolve_references/symbol_resolution.ts` - signature updated
- `packages/core/src/resolve_references/symbol_resolution.test_helpers.ts` - helper added
- 7 test files - all updated to use helper
