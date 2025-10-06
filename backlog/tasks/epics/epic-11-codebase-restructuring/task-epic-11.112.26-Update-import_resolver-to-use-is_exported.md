# Task epic-11.112.26: Update import_resolver to use is_exported

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 30 minutes
**Dependencies:** task-epic-11.112.23.1 (Type definitions)

## Objective

Update the `is_exported()` function in `import_resolver.ts` to use the new `is_exported` boolean field instead of checking `availability.scope`. This is a simple transition that makes the code cleaner and prepares for the eventual removal of the `availability` field.

## Current Implementation

In [import_resolver.ts:266-280](packages/core/src/resolve_references/import_resolution/import_resolver.ts#L266-L280):

```typescript
/**
 * Check if a definition is exported
 *
 * IMPORTANT: This uses availability.scope to determine if a symbol is exported.
 * Based on the codebase, "file-export" and "public" indicate exported symbols.
 *
 * @param def - Symbol definition to check
 * @returns true if the symbol is exported
 */
function is_exported(
  def:
    | FunctionDefinition
    | ClassDefinition
    | VariableDefinition
    | InterfaceDefinition
    | EnumDefinition
    | TypeAliasDefinition
    | ImportDefinition
): boolean {
  return (
    def.availability?.scope === "file-export" ||
    def.availability?.scope === "public"
  );
}
```

## Implementation Steps

### 1. Update is_exported Function (10 min)

Replace the complex availability check with the simple boolean field:

```typescript
/**
 * Check if a definition is exported
 *
 * Uses the is_exported flag which is set by language builders based on
 * language-specific export rules:
 * - JavaScript/TypeScript: Has 'export' keyword
 * - Python: Module-level and not private (no leading underscore)
 * - Rust: Has 'pub' modifier
 *
 * @param def - Symbol definition to check
 * @returns true if the symbol is exported
 */
function is_exported(
  def:
    | FunctionDefinition
    | ClassDefinition
    | VariableDefinition
    | InterfaceDefinition
    | EnumDefinition
    | TypeAliasDefinition
    | ImportDefinition
): boolean {
  return def.is_exported;
}
```

### 2. Keep Backward Compatibility During Migration (Optional, 5 min)

If language builders haven't all been updated yet, add a fallback:

```typescript
function is_exported(
  def:
    | FunctionDefinition
    | ClassDefinition
    | VariableDefinition
    | InterfaceDefinition
    | EnumDefinition
    | TypeAliasDefinition
    | ImportDefinition
): boolean {
  // Use new field if available
  if (def.is_exported !== undefined) {
    return def.is_exported;
  }

  // Fallback to old availability check during migration
  return (
    def.availability?.scope === "file-export" ||
    def.availability?.scope === "public"
  );
}
```

**Note:** This fallback can be removed once all language builders are updated (after tasks 11.112.23.2-4 complete).

### 3. Update find_export to use export metadata (5 min)

Update the `is_reexport` check to use the new location:

```typescript
function find_export(
  name: SymbolName,
  index: SemanticIndex
): ExportInfo | null {
  // Check all definition types
  const def =
    find_exported_function(name, index) ||
    find_exported_class(name, index) ||
    find_exported_variable(name, index) ||
    find_exported_interface(name, index) ||
    find_exported_enum(name, index) ||
    find_exported_type_alias(name, index);

  if (def) {
    return {
      symbol_id: def.symbol_id,
      is_reexport: def.export?.is_reexport || false,  // Updated from availability.export
    };
  }

  // Check for re-exported imports
  const reexport = find_reexported_import(name, index);
  if (reexport) {
    return {
      symbol_id: reexport.symbol_id,
      is_reexport: true,
      import_def: reexport,
    };
  }

  return null;
}
```

### 4. Update Documentation (5 min)

Update the comment in `find_reexported_import` to reference the new field:

```typescript
/**
 * Find a re-exported import by name (e.g., export { foo } from './bar')
 *
 * This handles the case where a file re-exports an imported symbol.
 * For example:
 *   // middle.js
 *   export { core } from './base'
 *
 * In the semantic index, this appears as an import with:
 * - is_exported = true
 * - export = { is_reexport: true }
 *
 * @param name - Symbol name to find
 * @param index - Semantic index to search in
 * @returns Import definition or null if not found
 */
function find_reexported_import(
  name: SymbolName,
  index: SemanticIndex
): ImportDefinition | null {
  // Implementation unchanged
  for (const [symbol_id, import_def] of index.imported_symbols) {
    if (import_def.name === name && is_exported(import_def)) {
      return import_def;
    }
  }
  return null;
}
```

### 5. Run Tests (5 min)

```bash
npm test -- import_resolver.test.ts
npm test -- symbol_resolution.javascript.test.ts
npm test -- symbol_resolution.typescript.test.ts
```

**Expected Results:**
- If language builders already populate `is_exported`: Tests should pass ✅
- If language builders haven't been updated yet: Tests pass with fallback logic ✅

## Files Modified

- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`

## Migration Path

### Immediate (This Task)
1. Update `is_exported()` to check `def.is_exported` field
2. Add fallback to `availability.scope` for backward compatibility
3. Update `find_export()` to use `def.export?.is_reexport`

### After Language Builders Updated (Tasks 11.112.23.2-4)
1. Remove fallback logic from `is_exported()`
2. Simplify to just: `return def.is_exported;`

### Final Cleanup (Future Task)
1. Remove `availability` field entirely
2. All code uses `is_exported` and `export` fields

## Success Criteria

- ✅ `is_exported()` uses new `is_exported` field
- ✅ Fallback to `availability.scope` works during migration
- ✅ Documentation updated to reference new fields
- ✅ All import resolution tests pass

## Benefits

1. **Simpler code**: One boolean check instead of two string comparisons
2. **Type-safe**: Boolean field is clearer than string enum
3. **Consistent**: All languages use same field name
4. **Maintainable**: Easier to understand and modify

## Next Task

**task-epic-11.112.24** - Implement Export Alias Resolution (depends on 11.112.23.2 completing)
