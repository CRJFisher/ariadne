# Sub-task 139.6: Migrate extract_import_specs() to DefinitionRegistry

**Parent Task**: task-epic-11.139
**Status**: Not Started
**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 1-2 days

## Overview

Migrate `extract_import_specs()` from using `index.scope_to_definitions` to using `DefinitionRegistry.get_scope_definitions()` added in sub-task 139.4.

**Why needed?**
- ✅ Sub-task 139.4 added scope query capability
- 🎯 Currently uses `index.scope_to_definitions` - need to migrate
- 🔄 ImportDefinitions should be in DefinitionRegistry (they ARE definitions!)
- 📍 Used by `build_scope_resolver_index` to create import resolvers

## Current Implementation

**File**: `import_resolution/import_resolver.ts:38-71`

```typescript
export function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath,
  root_folder: FileSystemFolder
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  // Get imports from scope_to_definitions index
  for (const import_def of (index.scope_to_definitions
    .get(scope_id)
    ?.get("import") || []) as ImportDefinition[]) {  // ← MIGRATE THIS

    if (import_def.defining_scope_id === scope_id) {
      // Resolve module path
      const source_file = resolve_module_path(
        import_def.import_path,
        file_path,
        index.language,
        root_folder
      );

      specs.push({
        symbol_id: import_def.symbol_id,
        local_name: import_def.name,
        source_file,
        import_name: import_def.original_name || import_def.name,
        import_kind: import_def.import_kind,
      });
    }
  }

  return specs;
}
```

**Key issue**: Uses `index.scope_to_definitions.get(scope_id)?.get("import")`

## Target Implementation

```typescript
export function extract_import_specs(
  scope_id: ScopeId,
  file_id: FilePath,
  language: Language,  // ← Need for resolve_module_path
  definitions: DefinitionRegistry,  // ← ADD
  root_folder: FileSystemFolder
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  // Get imports from DefinitionRegistry with kind filter
  const imports = definitions.get_scope_definitions(
    scope_id,
    file_id,
    "import"  // ← Filter by kind
  ) as ImportDefinition[];

  for (const import_def of imports) {
    // Resolve module path
    const source_file = resolve_module_path(
      import_def.import_path,
      file_id,
      language,
      root_folder
    );

    specs.push({
      symbol_id: import_def.symbol_id,
      local_name: import_def.name,
      source_file,
      import_name: import_def.original_name || import_def.name,
      import_kind: import_def.import_kind,
    });
  }

  return specs;
}
```

## Implementation Plan

### Step 1: Update Function Signature (30 min)

```typescript
// Before
export function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath,
  root_folder: FileSystemFolder
): ImportSpec[]

// After
export function extract_import_specs(
  scope_id: ScopeId,
  file_id: FilePath,
  language: Language,
  definitions: DefinitionRegistry,
  root_folder: FileSystemFolder
): ImportSpec[]
```

**Rationale for changes**:
- Remove `index` parameter (no longer need full SemanticIndex)
- Add `language` parameter (needed for `resolve_module_path`)
- Add `definitions` parameter (source of import data)

### Step 2: Update Implementation (1 hour)

```typescript
export function extract_import_specs(
  scope_id: ScopeId,
  file_id: FilePath,
  language: Language,
  definitions: DefinitionRegistry,
  root_folder: FileSystemFolder
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  // Query DefinitionRegistry for imports in this scope
  const scope_defs = definitions.get_scope_definitions(
    scope_id,
    file_id,
    "import"  // Filter by kind
  );

  // Cast to ImportDefinition (we know they're all imports due to filter)
  const imports = scope_defs as ImportDefinition[];

  for (const import_def of imports) {
    // Resolve the module path
    const source_file = resolve_module_path(
      import_def.import_path,
      file_id,
      language,
      root_folder
    );

    // Build ImportSpec
    specs.push({
      symbol_id: import_def.symbol_id,
      local_name: import_def.name,
      source_file,
      import_name: import_def.original_name || import_def.name,
      import_kind: import_def.import_kind,
    });
  }

  return specs;
}
```

**Note**: Removed `defining_scope_id` check because `get_scope_definitions` already filters by scope!

### Step 3: Update Caller in build_resolvers_recursive (1-2 hours)

**File**: `scope_resolver_index.ts:185`

```typescript
// Before
const import_specs = extract_import_specs(scope_id, index, file_path, root_folder);

// After
const import_specs = extract_import_specs(
  scope_id,
  file_path,
  index.language,  // ← Still need SemanticIndex for language!
  definitions,
  root_folder
);
```

**Issue**: We still need `index.language`!

**Options**:
1. Keep `index` parameter just for `.language` access
2. Pass `language` through `build_resolvers_recursive`
3. Store language in DefinitionRegistry per file

**Decision**: Option 1 for now (keep `index` parameter), can refactor later if we want language in registry.

Or alternatively, pass language through:

```typescript
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,  // ← Keep for .language
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,
  definitions: DefinitionRegistry,
  root_folder: FileSystemFolder
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>>
```

**Recommended**: Keep `index` parameter - language is metadata we might need elsewhere too.

### Step 4: Update Tests (2-3 hours)

**File**: `import_resolver.test.ts` and language-specific variants

```typescript
describe('extract_import_specs', () => {
  it('should extract named import specs', () => {
    const scope_id = 'scope:app.ts:module' as ScopeId;
    const file_id = 'app.ts' as FilePath;

    // Setup DefinitionRegistry
    const definitions = new DefinitionRegistry();

    const import_def: ImportDefinition = {
      kind: 'import',
      symbol_id: 'import:app.ts:helper:1:0' as SymbolId,
      name: 'helper' as SymbolName,
      import_path: './utils' as ModulePath,
      import_kind: 'named',
      original_name: undefined,
      defining_scope_id: scope_id,
      location: { /* ... */ },
      language: 'typescript',
      node_type: 'import_specifier',
      modifiers: [],
    };

    definitions.update_file(file_id, [import_def]);

    // Call extract_import_specs
    const specs = extract_import_specs(
      scope_id,
      file_id,
      'typescript',
      definitions,
      root_folder
    );

    expect(specs).toHaveLength(1);
    expect(specs[0].local_name).toBe('helper');
    expect(specs[0].import_kind).toBe('named');
  });

  // ... more tests for default, namespace, aliased imports ...
});
```

### Step 5: Integration Testing (1 hour)

Verify `build_scope_resolver_index` still works end-to-end:

```bash
npm test -- scope_resolver_index.test.ts --run
npm test -- symbol_resolution --run
```

All tests should pass with no regressions.

## Design Decision: Where Does Language Metadata Live?

### Issue
`extract_import_specs` needs the file's language for `resolve_module_path()`, but:
- We're removing SemanticIndex access
- DefinitionRegistry doesn't store language

### Options

**Option A: Keep SemanticIndex parameter for metadata**
```typescript
function build_resolvers_recursive(
  // ...
  index: SemanticIndex,  // ← Keep for .language, .scopes metadata
  // ...
  definitions: DefinitionRegistry,
  // ...
)
```

**Pros**: Simple, no changes to registries
**Cons**: Still depends on SemanticIndex

---

**Option B: Pass language explicitly**
```typescript
function build_resolvers_recursive(
  // ...
  file_language: Language,  // ← Extract from index at call site
  // ...
)
```

**Pros**: Clean parameter
**Cons**: More parameters to thread through

---

**Option C: Store language in registry**
```typescript
class DefinitionRegistry {
  private file_metadata: Map<FilePath, { language: Language }>

  update_file(file_id: FilePath, definitions: AnyDefinition[], language: Language) {
    // ...
    this.file_metadata.set(file_id, { language });
  }

  get_file_language(file_id: FilePath): Language | undefined {
    return this.file_metadata.get(file_id)?.language;
  }
}
```

**Pros**: Registries own all file data
**Cons**: More registry complexity, may not be worth it for one field

---

### Recommendation: Option A (Keep SemanticIndex for Metadata)

**Rationale**:
- Language is read-only metadata
- Multiple places might need it (not just imports)
- Keeping `index` parameter is simplest
- Can revisit later if we add FileMetadataRegistry

**Implementation**:
```typescript
function build_resolvers_recursive(
  scope_id: ScopeId,
  parent_resolvers: ReadonlyMap<SymbolName, SymbolResolver>,
  index: SemanticIndex,  // ← Keep for .language and .scopes
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  exports: ExportRegistry,
  definitions: DefinitionRegistry,
  root_folder: FileSystemFolder
): ReadonlyMap<ScopeId, Map<SymbolName, SymbolResolver>>
```

**Negotiation**: If this bothers us during 139.7, we can switch to Option B or C.

## Testing Strategy

### Unit Tests
- ✅ Named imports extracted correctly
- ✅ Default imports extracted correctly
- ✅ Namespace imports extracted correctly
- ✅ Aliased imports (original_name) handled
- ✅ Empty scopes return empty array
- ✅ Module path resolution works

### Integration Tests
- ✅ Scope resolver index builds correctly
- ✅ Import resolvers work end-to-end
- ✅ Cross-file resolution still works

## Acceptance Criteria

- [ ] `extract_import_specs()` signature updated
- [ ] Implementation uses `definitions.get_scope_definitions()`
- [ ] No use of `index.scope_to_definitions`
- [ ] All callers updated
- [ ] All tests passing
- [ ] Design decision documented (where language lives)

## Dependencies

**Prerequisites**:
- ✅ task-epic-11.139.4 (DefinitionRegistry.get_scope_definitions exists)
- ✅ task-epic-11.139.3 (definitions parameter threaded through)

**Enables**:
- 139.7 (full build_scope_resolver_index migration)

## Success Metrics

✅ All tests pass
✅ No `index.scope_to_definitions` access
✅ Code cleaner (using registry API)
✅ ImportDefinitions treated as first-class definitions

## Negotiation Points

### Question 1: Should ImportDefinitions be in DefinitionRegistry?

**Current assumption**: Yes, they implement `AnyDefinition` interface.

**Verify during implementation**: Does `get_scope_definitions` actually return them?

**If not**: Need to add imports to DefinitionRegistry in sub-task 139.4 or earlier.

### Question 2: Language metadata - final decision?

**Current**: Keep `index` parameter for `.language`

**Reconsider**: If we find we need more metadata, might be time for Option C (registry stores metadata).

**When to decide**: During 139.7 when we see the full picture of what `build_scope_resolver_index` needs.

## Notes

### ImportDefinitions Are Definitions!

This is an important conceptual point:
- Imports ARE definitions (they define symbols in the local scope)
- They implement the `AnyDefinition` interface
- DefinitionRegistry should manage them just like functions, classes, etc.

If this isn't already the case, we need to ensure `update_file()` includes imports in the definition list.

### Interaction with 139.5

Both 139.5 and 139.6 update helpers called by `build_resolvers_recursive`. They can be done in parallel, but both need to merge into 139.7.

Timeline:
- 139.5 and 139.6 can run in parallel (1-2 days each)
- 139.7 depends on both being complete
