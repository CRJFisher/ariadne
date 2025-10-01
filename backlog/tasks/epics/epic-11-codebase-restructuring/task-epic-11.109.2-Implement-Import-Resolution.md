# Task 11.109.2: Implement Import Resolution

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 4-5 days
**Parent:** task-epic-11.109
**Dependencies:** task-epic-11.109.1 (ScopeResolver)

## Objective

Implement cross-file import/export resolution that creates a per-file map of imported names to their source SymbolIds. This map will be consumed by ScopeResolver at module scope.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── import_resolution/
    ├── import_resolver.ts
    ├── export_finder.ts
    └── import_resolver.test.ts
```

### Core Types

```typescript
/**
 * Per-file import map: local_name -> source_symbol_id
 *
 * Example:
 * // In file: src/app.ts
 * import { foo, bar as baz } from './utils';
 *
 * ImportMap for src/app.ts:
 * {
 *   "foo" -> SymbolId(foo in src/utils.ts),
 *   "baz" -> SymbolId(bar in src/utils.ts)  // Note: aliased
 * }
 */
export type ImportMap = ReadonlyMap<
  FilePath,
  ReadonlyMap<SymbolName, SymbolId>
>;
```

### Main Function

```typescript
export function resolve_imports(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportMap {
  const import_map = new Map<FilePath, Map<SymbolName, SymbolId>>();

  for (const [file_path, index] of indices) {
    const file_imports = new Map<SymbolName, SymbolId>();

    for (const [import_id, import_def] of index.imported_symbols) {
      const resolved = resolve_import_to_source(import_def, indices);
      if (resolved) {
        // Store under local name (which may be aliased)
        file_imports.set(import_def.name, resolved);
      }
    }

    import_map.set(file_path, file_imports);
  }

  return import_map;
}
```

### Import Resolution Logic

```typescript
function resolve_import_to_source(
  import_def: ImportDefinition,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolId | null {
  // 1. Resolve import path to source file
  const source_file = resolve_module_path(import_def.import_path);
  const source_index = indices.get(source_file);
  if (!source_index) return null;

  // 2. Find the exported symbol based on import kind
  switch (import_def.import_kind) {
    case "named":
      return find_named_export(
        import_def.original_name || import_def.name,
        source_index
      );

    case "default":
      return find_default_export(source_index);

    case "namespace":
      // Namespace imports need special handling
      return null; // TODO: Future work
  }
}
```

### Export Finding

```typescript
function find_named_export(
  name: SymbolName,
  index: SemanticIndex
): SymbolId | null {
  // Find symbols with this name that are exported
  const candidates = index.symbols_by_name.get(name) || [];

  for (const symbol_id of candidates) {
    const def = find_definition(symbol_id, index);
    if (def && def.availability.scope === "file-export") {
      return symbol_id;
    }
  }

  return null;
}

function find_default_export(index: SemanticIndex): SymbolId | null {
  // Find the symbol with default export
  for (const definitions of [index.functions, index.classes, index.variables]) {
    for (const [symbol_id, def] of definitions) {
      if (def.availability.export?.is_default) {
        return symbol_id;
      }
    }
  }

  return null;
}
```

### Module Path Resolution

```typescript
function resolve_module_path(module_path: ModulePath): FilePath {
  // Handle different import path types:
  // - Relative: './utils', '../lib'
  // - Absolute: '/src/utils'
  // - Node modules: 'lodash', '@scope/package'
  // - Path aliases: '@/', '~/'

  // Initial implementation: relative paths only
  // TODO: Full resolution algorithm
  return module_path as FilePath;
}
```

## Test Coverage

### Unit Tests (`import_resolver.test.ts`)

Test cases for each language:

#### JavaScript/TypeScript

1. **Named imports** - `import { foo } from './utils'`
2. **Aliased imports** - `import { foo as bar } from './utils'`
3. **Default imports** - `import foo from './utils'`
4. **Mixed imports** - `import foo, { bar } from './utils'`
5. **Namespace imports** - `import * as utils from './utils'`
6. **Re-exports** - `export { foo } from './utils'`
7. **Missing exports** - Import of non-existent symbol

#### Python

1. **Module imports** - `import utils`
2. **From imports** - `from utils import foo`
3. **Aliased imports** - `from utils import foo as bar`
4. **Star imports** - `from utils import *`
5. **Relative imports** - `from .utils import foo`

#### Rust

1. **Use statements** - `use utils::foo;`
2. **Glob imports** - `use utils::*;`
3. **Aliased imports** - `use utils::foo as bar;`
4. **Nested paths** - `use utils::{foo, bar};`

### Integration Tests

Test complete import chains:

1. **Transitive imports** - A imports B imports C
2. **Circular imports** - A imports B, B imports A
3. **Cross-directory imports** - Different folder structures

## Success Criteria

### Functional

- ✅ Named imports resolve to source SymbolId
- ✅ Aliased imports use local name as key
- ✅ Default imports resolve correctly
- ✅ Namespace imports handled (or documented as future work)
- ✅ Non-existent imports return null gracefully
- ✅ All 4 languages supported

### Testing

- ✅ Unit tests for each import type per language
- ✅ Integration tests for cross-file scenarios
- ✅ Edge cases (circular, missing) covered

### Code Quality

- ✅ Full JSDoc documentation
- ✅ Pythonic naming convention
- ✅ Clear error handling
- ✅ Type-safe implementation
- ✅ Extensible for future enhancements

## Technical Notes

### ImportDefinition Structure

```typescript
interface ImportDefinition {
  kind: "import";
  import_path: ModulePath;
  import_kind: "named" | "default" | "namespace";
  original_name?: SymbolName; // For aliased imports
  name: SymbolName; // Local name
}
```

### SymbolAvailability

```typescript
interface SymbolAvailability {
  scope: "file-private" | "file-export" | "package-internal" | "public";
  export?: {
    name: SymbolName;
    is_default?: boolean;
    is_reexport?: boolean;
  };
}
```

### Module Resolution Strategy

**Phase 1 (this task):** Relative paths only

- `./utils` → same directory
- `../utils` → parent directory

**Phase 2 (future):** Full resolution

- Node modules resolution
- Path aliases
- Package.json exports
- TypeScript path mapping

## Known Limitations

Document these for future work:

1. **Namespace imports** - Not fully supported (return null)
2. **Star exports** - May not resolve completely
3. **Node modules** - External packages not resolved
4. **Dynamic imports** - Runtime imports ignored
5. **Re-export chains** - May need multiple hops

## Dependencies

**Uses:**

- `ImportDefinition` from types
- `SemanticIndex` for definitions
- `SymbolAvailability` for export checking

**Consumed by:**

- Task 11.109.1 `ScopeResolver` (uses ImportMap)

## Next Steps

After completion:

- ScopeResolver will consume ImportMap
- Function/method/constructor resolvers will benefit
- Future task: Enhance module path resolution
