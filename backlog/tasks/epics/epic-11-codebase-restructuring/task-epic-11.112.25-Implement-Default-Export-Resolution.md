# Task epic-11.112.25: Implement Default Export Resolution

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1.5 hours
**Dependencies:** task-epic-11.112.23.2 (JavaScript/TypeScript), task-epic-11.112.24

## Objective

Fix the critical bug where default exports cannot be resolved. Currently, `import calc from './math'` fails when the export is `export default function calculate() {}` because there's no mechanism to match a default import to a default export.

## Problem Statement

### Current Broken Behavior

```javascript
// math.js
export default function calculate() { return 42; }

// main.js
import calc from './math';  // ❌ FAILS
calc();
```

**Why it fails:**
1. Semantic index creates definition: `name = "calculate"`
2. Builder marks: `is_exported = true, export = { is_default: true }`
3. Import uses `import_kind = "default"`
4. Import resolver searches for: `find_export("calc", index)` ❌ **WRONG APPROACH**
5. No match found because we're searching by local import name, not by default export flag

### Expected Behavior

For default imports, the resolver should:
1. Detect `import_kind = "default"` in the import spec
2. Search for ANY definition with `export.is_default = true`
3. Ignore the local import name (it's user-chosen, not part of the export)
4. Return the default export definition ✅

## Implementation Steps

### 1. Update extract_import_specs (20 min)

In `packages/core/src/resolve_references/import_resolution/import_resolver.ts`:

The function already extracts `import_kind`, but we need to ensure it's properly used:

```typescript
export function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  for (const import_def of index.imported_symbols.values()) {
    if (import_def.defining_scope_id === scope_id) {
      const source_file = resolve_module_path(
        import_def.import_path,
        file_path,
        index.language
      );

      specs.push({
        local_name: import_def.name,
        source_file,
        import_name: import_def.original_name || import_def.name,
        import_kind: import_def.import_kind,  // ✅ Already extracted
      });
    }
  }

  return specs;
}
```

### 2. Update resolve_export_chain to Handle Default (30 min)

Add a new parameter to handle default imports:

```typescript
/**
 * Follow export chain to find the ultimate source symbol.
 *
 * @param source_file - File containing the export
 * @param export_name - Name of the exported symbol (ignored for default imports)
 * @param indices - Map of all semantic indices
 * @param import_kind - Type of import (named, default, or namespace)
 * @param visited - Set of visited exports for cycle detection
 * @returns Symbol ID of the exported symbol, or null if not found
 */
export function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  import_kind: "named" | "default" | "namespace" = "named",  // NEW parameter
  visited: Set<string> = new Set()
): SymbolId | null {
  const source_index = indices.get(source_file);
  if (!source_index) {
    throw new Error(`Source index not found for file: ${source_file}`);
  }

  // Detect cycles
  const key = `${source_file}:${export_name}:${import_kind}`;
  if (visited.has(key)) {
    return null; // Circular re-export
  }
  visited.add(key);

  // Look for export in source file
  const export_info = import_kind === "default"
    ? find_default_export(source_index)    // NEW: Handle default
    : find_export(export_name, source_index);

  if (!export_info) {
    throw new Error(
      import_kind === "default"
        ? `Default export not found in file: ${source_file}`
        : `Export not found for symbol: ${export_name} in file: ${source_file}`
    );
  }

  // If it's a re-exported import, follow the chain
  if (export_info.is_reexport && export_info.import_def) {
    const import_def = export_info.import_def;
    const resolved_file = resolve_module_path(
      import_def.import_path,
      source_file,
      source_index.language
    );

    // Recursively resolve with the correct import kind
    const original_name = import_def.original_name || import_def.name;
    const next_import_kind = import_def.import_kind || "named";
    return resolve_export_chain(
      resolved_file,
      original_name,
      indices,
      next_import_kind,  // Pass through import kind
      visited
    );
  }

  // Direct export
  return export_info.symbol_id;
}
```

### 3. Add find_default_export Function (25 min)

Create a new function to find default exports:

```typescript
/**
 * Find the default export in a file's index
 *
 * Default exports are marked with export.is_default = true.
 * There should only be one default export per file.
 *
 * @param index - Semantic index to search in
 * @returns Export information or null if not found
 */
function find_default_export(index: SemanticIndex): ExportInfo | null {
  // Search functions
  for (const func_def of index.functions.values()) {
    if (func_def.export?.is_default) {
      return {
        symbol_id: func_def.symbol_id,
        is_reexport: func_def.export.is_reexport || false,
      };
    }
  }

  // Search classes
  for (const class_def of index.classes.values()) {
    if (class_def.export?.is_default) {
      return {
        symbol_id: class_def.symbol_id,
        is_reexport: class_def.export.is_reexport || false,
      };
    }
  }

  // Search variables
  for (const var_def of index.variables.values()) {
    if (var_def.export?.is_default) {
      return {
        symbol_id: var_def.symbol_id,
        is_reexport: var_def.export.is_reexport || false,
      };
    }
  }

  // Search interfaces (TypeScript only)
  for (const iface_def of index.interfaces.values()) {
    if (iface_def.export?.is_default) {
      return {
        symbol_id: iface_def.symbol_id,
        is_reexport: iface_def.export.is_reexport || false,
      };
    }
  }

  // Search enums (TypeScript only)
  for (const enum_def of index.enums.values()) {
    if (enum_def.export?.is_default) {
      return {
        symbol_id: enum_def.symbol_id,
        is_reexport: enum_def.export.is_reexport || false,
      };
    }
  }

  // Search type aliases (TypeScript only)
  for (const type_def of index.types.values()) {
    if (type_def.export?.is_default) {
      return {
        symbol_id: type_def.symbol_id,
        is_reexport: type_def.export.is_reexport || false,
      };
    }
  }

  return null;
}
```

### 4. Update ScopeResolverIndex to Pass import_kind (15 min)

In `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`:

Ensure the resolver function passes `import_kind` to `resolve_export_chain`:

```typescript
// When creating resolvers for imports
const resolver: SymbolResolver = (indices) => {
  return resolve_export_chain(
    spec.source_file,
    spec.import_name,
    indices,
    spec.import_kind,  // ✅ Pass import kind
  );
};
```

### 5. Add Comprehensive Tests (20 min)

In `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`:

```typescript
describe("Default Export Resolution", () => {
  it("resolves default import to default export", () => {
    // math.ts: export default function calculate() {}
    const math_index = create_index({
      functions: [
        {
          name: "calculate" as SymbolName,
          is_exported: true,
          export: { is_default: true },
          symbol_id: "fn:/math.ts:calculate:1:0" as SymbolId,
        }
      ]
    });

    // main.ts: import calc from './math'
    const result = resolve_export_chain(
      "/math.ts" as FilePath,
      "calc" as SymbolName,  // Local name (ignored for default)
      new Map([["/math.ts" as FilePath, math_index]]),
      "default"  // Import kind
    );

    expect(result).toBe("fn:/math.ts:calculate:1:0");
  });

  it("resolves default class export", () => {
    // user.ts: export default class User {}
    const user_index = create_index({
      classes: [
        {
          name: "User" as SymbolName,
          is_exported: true,
          export: { is_default: true },
          symbol_id: "class:/user.ts:User:1:0" as SymbolId,
        }
      ]
    });

    // main.ts: import MyUser from './user'
    const result = resolve_export_chain(
      "/user.ts" as FilePath,
      "MyUser" as SymbolName,  // Local name (ignored)
      new Map([["/user.ts" as FilePath, user_index]]),
      "default"
    );

    expect(result).toBe("class:/user.ts:User:1:0");
  });

  it("throws when no default export exists", () => {
    // lib.ts: export function foo() {}  (no default)
    const lib_index = create_index({
      functions: [
        {
          name: "foo" as SymbolName,
          is_exported: true,
          // No is_default flag
        }
      ]
    });

    // main.ts: import something from './lib'
    expect(() => {
      resolve_export_chain(
        "/lib.ts" as FilePath,
        "something" as SymbolName,
        new Map([["/lib.ts" as FilePath, lib_index]]),
        "default"
      );
    }).toThrow("Default export not found");
  });

  it("handles default re-exports", () => {
    // base.ts: export default function core() {}
    const base_index = create_index({
      functions: [
        {
          name: "core" as SymbolName,
          is_exported: true,
          export: { is_default: true },
          symbol_id: "fn:/base.ts:core:1:0" as SymbolId,
        }
      ]
    });

    // barrel.ts: export { default } from './base'
    const barrel_index = create_index({
      imported_symbols: [
        {
          name: "default" as SymbolName,
          is_exported: true,
          export: { is_default: true, is_reexport: true },
          import_path: "./base",
          import_kind: "default",
        }
      ]
    });

    // main.ts: import something from './barrel'
    const result = resolve_export_chain(
      "/barrel.ts" as FilePath,
      "something" as SymbolName,
      new Map([
        ["/barrel.ts" as FilePath, barrel_index],
        ["/base.ts" as FilePath, base_index]
      ]),
      "default"
    );

    expect(result).toBe("fn:/base.ts:core:1:0");
  });
});
```

## Files Modified

- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`
- `packages/core/src/resolve_references/scope_resolver_index/scope_resolver_index.ts`

## Testing

```bash
npm test -- import_resolver.test.ts
npm test -- symbol_resolution.javascript.test.ts
npm test -- symbol_resolution.typescript.test.ts
```

## Success Criteria

- ✅ Default imports resolve to default exports
- ✅ Local import name is correctly ignored for default imports
- ✅ Default re-exports work through the chain
- ✅ Error thrown when default export not found
- ✅ All import resolver tests pass
- ✅ Integration tests pass

## Edge Cases

### Anonymous Default Exports

```javascript
// math.js
export default function() { return 42; }  // Anonymous function
```

The semantic index should create a definition with a generated name (e.g., `"<anonymous>"`), and mark it with `is_default = true`.

### Multiple Default Exports (Invalid)

```javascript
export default foo;
export default bar;  // Syntax error in most languages
```

This is a syntax error in JavaScript/TypeScript, so the parser won't create a valid AST. No special handling needed.

## Future Work

- Handle `export { default } from './other'` re-export syntax
- Support namespace imports (`import * as ns from './lib'`)
- Validate that only one default export exists per file
