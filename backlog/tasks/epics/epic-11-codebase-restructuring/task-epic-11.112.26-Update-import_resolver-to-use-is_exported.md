# Task epic-11.112.26: Add exported_symbols map to SemanticIndex

**Parent:** task-epic-11.112
**Status:** Completed
**Estimated Time:** 1 hour
**Dependencies:** task-epic-11.112.23.1 (Type definitions)

## Objective

Dramatically simplify import resolution by adding an `exported_symbols` map to SemanticIndex. This eliminates all the repetitive `find_exported_*` functions and replaces O(n) iteration with O(1) map lookup.

## Current Implementation Problems

In [import_resolver.ts:134-280](import_resolver.ts#L134-L280):

**147 lines of repetitive code**:
- `find_export()` - orchestrates searching across 6 definition types
- `find_exported_function()` - iterates functions, checks `is_exported()`
- `find_exported_class()` - iterates classes, checks `is_exported()`
- `find_exported_variable()` - iterates variables, checks `is_exported()`
- `find_exported_interface()` - iterates interfaces, checks `is_exported()`
- `find_exported_enum()` - iterates enums, checks `is_exported()`
- `find_exported_type_alias()` - iterates types, checks `is_exported()`
- `is_exported()` - checks `availability.scope === "file-export" || "public"`

**Problems:**
1. **Code duplication**: 6 nearly-identical finder functions
2. **Performance**: O(n) iteration through each collection
3. **Fragile**: Easy to miss a definition type
4. **No validation**: Duplicate export names would silently cause bugs

## New Implementation

### Add to SemanticIndex

Following the pattern of `symbols_by_name` (see [semantic_index.ts:82](packages/core/src/index_single_file/semantic_index.ts#L82)):

```typescript
export interface SemanticIndex {
  // ... existing fields

  /** Quick lookup: name -> symbols with that name in this file */
  readonly symbols_by_name: ReadonlyMap<SymbolName, readonly SymbolId[]>;

  /** Quick lookup: export name -> exported definition (NEW) */
  readonly exported_symbols: ReadonlyMap<SymbolName, AnyDefinition>;
}
```

## Implementation Steps

### 1. Add AnyDefinition Type (5 min)

In `packages/core/src/index_single_file/semantic_index.ts`:

```typescript
/**
 * Union type for any definition type
 * Used for maps that can contain any kind of definition
 */
export type AnyDefinition =
  | FunctionDefinition
  | ClassDefinition
  | VariableDefinition
  | InterfaceDefinition
  | EnumDefinition
  | NamespaceDefinition
  | TypeAliasDefinition
  | ImportDefinition;
```

### 2. Add exported_symbols Field to SemanticIndex (2 min)

```typescript
export interface SemanticIndex {
  readonly file_path: FilePath;
  readonly language: Language;
  readonly root_scope_id: ScopeId;
  readonly scopes: ReadonlyMap<ScopeId, LexicalScope>;

  // ... existing definition maps

  readonly references: readonly SymbolReference[];
  readonly symbols_by_name: ReadonlyMap<SymbolName, readonly SymbolId[]>;
  readonly exported_symbols: ReadonlyMap<SymbolName, AnyDefinition>; // NEW

  // ... type data
}
```

### 3. Create build_exported_symbols_map Function (20 min)

Following the pattern of `build_name_index()` at [semantic_index.ts:269](packages/core/src/index_single_file/semantic_index.ts#L269):

```typescript
/**
 * Build export lookup map from all definitions
 *
 * IMPORTANT: Asserts that export names are unique within a file.
 * If two different symbols are exported with the same name, this indicates
 * a bug in the is_exported logic or a malformed source file.
 *
 * @param result - Builder result containing all definitions
 * @returns Map from export name to definition
 * @throws Error if duplicate export names are found
 */
function build_exported_symbols_map(result: BuilderResult): Map<SymbolName, AnyDefinition> {
  const map = new Map<SymbolName, AnyDefinition>();

  const add_to_map = (def: AnyDefinition) => {
    // Only add exported symbols
    if (!def.is_exported) {
      return;
    }

    // Get the effective export name (alias or original name)
    const export_name = def.export?.export_name || def.name;

    // Check for duplicates - this should never happen
    const existing = map.get(export_name);
    if (existing) {
      throw new Error(
        `Duplicate export name "${export_name}" in file.\n` +
        `  First:  ${existing.kind} ${existing.symbol_id}\n` +
        `  Second: ${def.kind} ${def.symbol_id}\n` +
        `This indicates a bug in is_exported logic or malformed source code.`
      );
    }

    map.set(export_name, def);
  };

  // Add all definition types
  result.functions.forEach(add_to_map);
  result.classes.forEach(add_to_map);
  result.variables.forEach(add_to_map);
  result.interfaces.forEach(add_to_map);
  result.enums.forEach(add_to_map);
  result.namespaces.forEach(add_to_map);
  result.types.forEach(add_to_map);
  result.imports.forEach(add_to_map);  // For re-exports

  return map;
}
```

### 4. Call build_exported_symbols_map in build_semantic_index (5 min)

Update the index building at [semantic_index.ts:148-194](packages/core/src/index_single_file/semantic_index.ts#L148-L194):

```typescript
export function build_semantic_index(
  file: ParsedFile,
  tree: Tree,
  language: Language
): SemanticIndex {
  // ... existing passes 1-5

  // PASS 5: Build name index
  const symbols_by_name = build_name_index(builder_result);

  // PASS 5.5: Build exported symbols map (NEW)
  const exported_symbols = build_exported_symbols_map(builder_result);

  // PASS 6: Extract type preprocessing data
  const type_bindings_from_defs = extract_type_bindings({
    // ... existing
  });

  // ... rest of function

  return {
    file_path: file.file_path,
    language,
    root_scope_id: context.root_scope_id,
    scopes: context.scopes,
    functions: builder_result.functions,
    classes: builder_result.classes,
    variables: builder_result.variables,
    interfaces: builder_result.interfaces,
    enums: builder_result.enums,
    namespaces: builder_result.namespaces,
    types: builder_result.types,
    imported_symbols: builder_result.imports,
    references: all_references,
    symbols_by_name,
    exported_symbols,  // NEW
    type_bindings,
    type_members,
    type_alias_metadata,
  };
}
```

### 5. Simplify find_export in import_resolver.ts (15 min)

**Delete 140+ lines** of code and replace with:

```typescript
/**
 * Find an exported symbol in a file's index
 *
 * Uses the exported_symbols map for O(1) lookup instead of iterating
 * through all definition collections.
 *
 * @param name - Symbol name as it appears in the import statement
 * @param index - Semantic index to search in
 * @returns Export information or null if not found
 */
function find_export(
  name: SymbolName,
  index: SemanticIndex
): ExportInfo | null {
  const def = index.exported_symbols.get(name);

  if (!def) {
    return null;
  }

  return {
    symbol_id: def.symbol_id,
    is_reexport: def.export?.is_reexport || false,
  };
}
```

**Delete these functions entirely:**
- `find_exported_function()`
- `find_exported_class()`
- `find_exported_variable()`
- `find_exported_interface()`
- `find_exported_enum()`
- `find_exported_type_alias()`
- `find_reexported_import()` (logic now in exported_symbols map)
- `is_exported()` (no longer needed)

### 6. Add Backward Compatibility Fallback (Optional, 10 min)

If language builders haven't been updated yet, make `build_exported_symbols_map` check both fields:

```typescript
const add_to_map = (def: AnyDefinition) => {
  // Check new field first
  const is_exported_new = def.is_exported;

  // Fallback to old availability check during migration
  const is_exported_old =
    def.availability?.scope === "file-export" ||
    def.availability?.scope === "public";

  if (!is_exported_new && !is_exported_old) {
    return;
  }

  // ... rest of function
};
```

### 7. Run Tests (3 min)

```bash
npm test -- import_resolver.test.ts
npm test -- symbol_resolution.javascript.test.ts
npm test -- symbol_resolution.typescript.test.ts
npm test -- symbol_resolution.integration.test.ts
```

## Files Modified

- `packages/core/src/index_single_file/semantic_index.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`

## Success Criteria

- ✅ `SemanticIndex` has `exported_symbols` map
- ✅ Map built once during index creation
- ✅ Duplicate export names throw clear error
- ✅ `find_export()` is simple O(1) map lookup
- ✅ 140+ lines of repetitive code deleted
- ✅ All import resolution tests pass

## Benefits

### Performance
- **Before**: O(n) iteration through 6+ collections
- **After**: O(1) map lookup

### Code Quality
- **Before**: 147 lines of repetitive finder functions
- **After**: 10 lines for find_export + map building

### Correctness
- **Before**: Duplicate export names silently picked first match
- **After**: Duplicate export names throw error immediately

### Maintainability
- **Before**: Adding new definition type requires new finder function
- **After**: New types automatically included in map

## Migration Path

### Immediate (This Task)
1. Add `exported_symbols` map to SemanticIndex
2. Build map in `build_semantic_index()`
3. Simplify `find_export()` to use map
4. Delete all finder functions

### After Language Builders Updated (Tasks 11.112.23.2-4)
1. Remove fallback logic from `build_exported_symbols_map()`
2. Only check `def.is_exported` field

### Final Cleanup (Future Task)
1. Remove `availability` field entirely
2. All code uses `is_exported` and `export` fields

## Next Task

**task-epic-11.112.24** - Implement Export Alias Resolution (will use exported_symbols map)
