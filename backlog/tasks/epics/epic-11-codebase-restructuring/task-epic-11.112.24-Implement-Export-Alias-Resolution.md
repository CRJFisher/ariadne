# Task epic-11.112.24: Implement Export Alias Resolution

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Dependencies:** task-epic-11.112.23.2 (JavaScript/TypeScript)

## Objective

Fix the critical bug where export aliases cannot be resolved. Currently, `import { publicName } from './lib'` fails when the export is `export { internalName as publicName }` because the import resolver searches for a definition named `publicName`, but the definition is actually named `internalName`.

## Problem Statement

### Current Broken Behavior

```javascript
// lib.js
function internalName() { return 42; }
export { internalName as publicName };

// main.js
import { publicName } from './lib';  // ❌ FAILS
publicName();
```

**Why it fails:**
1. Semantic index creates definition: `name = "internalName"`
2. Builder marks: `is_exported = true, export = { export_name: "publicName" }`
3. Import resolver calls: `find_export("publicName", index)`
4. Search logic: `def.name === "publicName"` ❌ **NO MATCH**

### Expected Behavior

The import resolver should:
1. Search by export name when available: `get_export_name(def) === "publicName"`
2. Fall back to definition name if no alias: `def.name === "publicName"`
3. Match the correct definition and resolve the import ✅

## Implementation Steps

### 1. Update find_export Function (30 min)

In `packages/core/src/resolve_references/import_resolution/import_resolver.ts`:

```typescript
/**
 * Find an exported symbol in a file's index
 *
 * IMPORTANT: This must search by EXPORT NAME, not DEFINITION NAME.
 * Export aliases mean the export name may differ from the definition name.
 *
 * Example:
 *   export { internalName as publicName }
 *   → Definition name: "internalName"
 *   → Export name: "publicName"
 *   → Import uses: "publicName"
 *
 * @param name - Symbol name as it appears in the import statement
 * @param index - Semantic index to search in
 * @returns Export information or null if not found
 */
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
      is_reexport: def.export?.is_reexport || false,
    };
  }

  // Check for re-exported imports (e.g., export { foo } from './bar')
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

### 2. Update Individual find_exported_* Functions (45 min)

Each finder must check BOTH the export name AND definition name:

```typescript
/**
 * Find an exported function by export name
 *
 * Searches by:
 * 1. Export alias if present (export.export_name)
 * 2. Definition name otherwise (def.name)
 */
function find_exported_function(
  export_name: SymbolName,
  index: SemanticIndex
): FunctionDefinition | null {
  for (const [symbol_id, func_def] of index.functions) {
    if (!is_exported(func_def)) {
      continue;
    }

    // Check export alias first
    if (func_def.export?.export_name === export_name) {
      return func_def;
    }

    // Fall back to definition name
    if (func_def.name === export_name) {
      return func_def;
    }
  }
  return null;
}

// Apply same pattern to:
// - find_exported_class
// - find_exported_variable
// - find_exported_interface
// - find_exported_enum
// - find_exported_type_alias
```

### 3. Add Helper Function (10 min)

Create a reusable helper to get the effective export name:

```typescript
/**
 * Get the effective export name for a definition
 * Returns the alias if present, otherwise the definition name
 */
function get_effective_export_name(def: Definition): SymbolName {
  return def.export?.export_name || def.name;
}

/**
 * Check if definition matches the requested export name
 */
function matches_export_name(def: Definition, export_name: SymbolName): boolean {
  if (!is_exported(def)) {
    return false;
  }
  return get_effective_export_name(def) === export_name;
}
```

Then simplify the finders:

```typescript
function find_exported_function(
  export_name: SymbolName,
  index: SemanticIndex
): FunctionDefinition | null {
  for (const func_def of index.functions.values()) {
    if (matches_export_name(func_def, export_name)) {
      return func_def;
    }
  }
  return null;
}
```

### 4. Update Re-export Finder (15 min)

Update `find_reexported_import` to also check export names:

```typescript
function find_reexported_import(
  export_name: SymbolName,
  index: SemanticIndex
): ImportDefinition | null {
  for (const import_def of index.imported_symbols.values()) {
    if (matches_export_name(import_def, export_name)) {
      return import_def;
    }
  }
  return null;
}
```

### 5. Add Comprehensive Tests (20 min)

In `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`:

```typescript
describe("Export Alias Resolution", () => {
  it("resolves import using export alias", () => {
    // lib.ts
    const lib_index = create_index({
      functions: [
        {
          name: "internalFoo" as SymbolName,
          is_exported: true,
          export: { export_name: "publicFoo" as SymbolName },
          // ... other fields
        }
      ]
    });

    // main.ts: import { publicFoo } from './lib'
    const result = resolve_export_chain(
      "/lib.ts" as FilePath,
      "publicFoo" as SymbolName,
      new Map([["/lib.ts" as FilePath, lib_index]])
    );

    expect(result).toBe("fn:/lib.ts:internalFoo:1:0");
  });

  it("resolves import using definition name when no alias", () => {
    // lib.ts
    const lib_index = create_index({
      functions: [
        {
          name: "foo" as SymbolName,
          is_exported: true,
          // No export alias
          // ... other fields
        }
      ]
    });

    // main.ts: import { foo } from './lib'
    const result = resolve_export_chain(
      "/lib.ts" as FilePath,
      "foo" as SymbolName,
      new Map([["/lib.ts" as FilePath, lib_index]])
    );

    expect(result).toBe("fn:/lib.ts:foo:1:0");
  });

  it("fails when import name does not match export or definition name", () => {
    // lib.ts
    const lib_index = create_index({
      functions: [
        {
          name: "internalFoo" as SymbolName,
          is_exported: true,
          export: { export_name: "publicFoo" as SymbolName },
        }
      ]
    });

    // main.ts: import { wrongName } from './lib'
    expect(() => {
      resolve_export_chain(
        "/lib.ts" as FilePath,
        "wrongName" as SymbolName,
        new Map([["/lib.ts" as FilePath, lib_index]])
      );
    }).toThrow("Export not found");
  });
});
```

## Files Modified

- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`

## Testing

```bash
npm test -- import_resolver.test.ts
npm test -- symbol_resolution.javascript.test.ts
npm test -- symbol_resolution.typescript.test.ts
```

## Success Criteria

- ✅ Import with export alias resolves correctly
- ✅ Import without alias still works
- ✅ Helper functions extract effective export name
- ✅ All import resolver tests pass
- ✅ Integration tests pass

## Next Task

**task-epic-11.112.25** - Implement Default Export Resolution
