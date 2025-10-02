# Task 11.109.2: Implement Lazy Import Resolution

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 4-5 days
**Parent:** task-epic-11.109
**Dependencies:** None

## Objective

Implement lazy import resolution that creates resolver functions for imported symbols. These resolvers are invoked on-demand when an imported symbol is first referenced, following export chains only when needed. This eliminates pre-computing unused import resolutions.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── import_resolution/
    ├── lazy_import_resolver.ts
    └── lazy_import_resolver.test.ts
```

### Core Concept

Import resolution is fully lazy:
1. During resolver index build, create **import resolver functions** (lightweight closures)
2. When an imported symbol is referenced, **call the resolver function** (follows export chain)
3. **Cache the result** in the resolution cache
4. Subsequent references use the cached symbol_id

### Import Resolver Function

```typescript
/**
 * Creates a resolver function for an imported symbol.
 * The resolver follows the export chain lazily when called.
 */
function create_import_resolver(
  import_spec: ImportSpec,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolResolver {
  return () => {
    // This code runs ON-DEMAND when first referenced
    return resolve_export_chain(
      import_spec.source_file,
      import_spec.import_name,
      indices
    );
  };
}
```

### Types

```typescript
/**
 * Import specification extracted from ImportDefinition
 */
interface ImportSpec {
  local_name: SymbolName;      // Name used in importing file
  source_file: FilePath;       // Resolved target file path
  import_name: SymbolName;     // Name to look up in source file
  import_kind: "named" | "default" | "namespace";
}

/**
 * Resolver function type (returns symbol_id or null)
 */
type SymbolResolver = () => SymbolId | null;
```

### Main Algorithm

```typescript
/**
 * Extract import specifications from a scope's import statements.
 * Used by ScopeResolverIndex when building resolver functions.
 */
export function extract_import_specs(
  scope_id: ScopeId,
  index: SemanticIndex,
  file_path: FilePath
): ImportSpec[] {
  const specs: ImportSpec[] = [];

  // Find all import statements in this scope
  const imports = find_imports_in_scope(scope_id, index);

  for (const import_def of imports) {
    // Resolve the module path to a file path
    const source_file = resolve_module_path(
      import_def.import_path,
      file_path
    );

    // Create spec for this import
    specs.push({
      local_name: import_def.name,
      source_file,
      import_name: import_def.original_name || import_def.name,
      import_kind: import_def.import_kind,
    });
  }

  return specs;
}
```

### Export Chain Resolution

```typescript
/**
 * Follow export chain to find the ultimate source symbol.
 * This runs lazily when an import resolver is first invoked.
 */
function resolve_export_chain(
  source_file: FilePath,
  export_name: SymbolName,
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  visited: Set<string> = new Set()
): SymbolId | null {
  // Cycle detection
  const chain_key = `${source_file}:${export_name}`;
  if (visited.has(chain_key)) {
    return null; // Circular re-export
  }
  visited.add(chain_key);

  const source_index = indices.get(source_file);
  if (!source_index) return null;

  // Look for export in source file
  const export_def = find_export(export_name, source_index);
  if (!export_def) return null;

  // If it's a re-export, follow the chain
  if (export_def.is_reexport && export_def.source_file) {
    return resolve_export_chain(
      export_def.source_file,
      export_def.source_name || export_name,
      indices,
      visited
    );
  }

  // Found the ultimate source symbol
  return export_def.symbol_id;
}
```

### Export Finding

```typescript
/**
 * Find an exported symbol in a file's index
 */
function find_export(
  name: SymbolName,
  index: SemanticIndex
): ExportInfo | null {
  // Check all definition types
  const def =
    find_exported_function(name, index) ||
    find_exported_class(name, index) ||
    find_exported_variable(name, index);

  if (!def) return null;

  return {
    symbol_id: def.symbol_id,
    is_reexport: def.availability?.export?.is_reexport || false,
    source_file: def.availability?.export?.source_file,
    source_name: def.availability?.export?.source_name,
  };
}

function find_exported_function(
  name: SymbolName,
  index: SemanticIndex
): FunctionDefinition | null {
  for (const [symbol_id, func_def] of index.functions) {
    if (func_def.name === name && is_exported(func_def)) {
      return func_def;
    }
  }
  return null;
}

// Similar for classes, variables...

function is_exported(def: AnyDefinition): boolean {
  return (
    def.availability?.scope === "file-export" ||
    def.availability?.scope === "public"
  );
}
```

### Module Path Resolution

```typescript
/**
 * Resolve import path to absolute file path
 */
function resolve_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Handle relative imports
  if (import_path.startsWith('./') || import_path.startsWith('../')) {
    return resolve_relative_path(import_path, importing_file);
  }

  // Handle absolute imports (future)
  // Handle node_modules (future)
  // Handle path aliases (future)

  return import_path as FilePath;
}

function resolve_relative_path(
  relative_path: string,
  base_file: FilePath
): FilePath {
  const base_dir = path.dirname(base_file);
  const resolved = path.resolve(base_dir, relative_path);

  // Try with common extensions
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.js`,
    `${resolved}.py`,
    `${resolved}.rs`,
    `${resolved}/index.ts`,
    `${resolved}/index.js`,
  ];

  // Return first existing file (or resolved path if none found)
  return resolved as FilePath;
}
```

### Integration with ScopeResolverIndex

```typescript
// In scope_resolver_index.ts:

function add_import_resolvers(
  scope_id: ScopeId,
  resolvers: Map<SymbolName, SymbolResolver>,
  index: SemanticIndex,
  file_path: FilePath,
  indices: ReadonlyMap<FilePath, SemanticIndex>
) {
  // Extract import specs for this scope
  const import_specs = extract_import_specs(scope_id, index, file_path);

  // Create lazy resolver for each import
  for (const spec of import_specs) {
    const resolver = create_lazy_import_resolver(spec, indices);
    resolvers.set(spec.local_name, resolver);
  }
}

function create_lazy_import_resolver(
  spec: ImportSpec,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolResolver {
  return () => {
    // Runs on-demand when first referenced
    return resolve_export_chain(
      spec.source_file,
      spec.import_name,
      indices
    );
  };
}
```

## Scope-Level Imports

Imports can occur at any scope level, not just module scope:

```typescript
// TypeScript
function foo() {
  import('./dynamic-module');  // Dynamic import (future work)
}

// Python
def foo():
    from module import something  # Local import
    something()
```

The algorithm handles this naturally by checking for imports in **every scope**, not just root scope.

## Test Coverage

### Unit Tests (`lazy_import_resolver.test.ts`)

#### Core Functionality
1. **Extract import specs** - Parse import statements into specs
2. **Resolve relative paths** - `./utils` → correct file path
3. **Find exports** - Locate exported symbols in target file
4. **Follow re-export chain** - A exports from B exports from C
5. **Cycle detection** - A re-exports from B re-exports from A

#### JavaScript/TypeScript
1. **Named imports** - `import { foo } from './utils'`
2. **Aliased imports** - `import { foo as bar } from './utils'`
3. **Default imports** - `import foo from './utils'`
4. **Mixed imports** - `import foo, { bar } from './utils'`
5. **Re-exports** - `export { foo } from './utils'`
6. **Missing exports** - Import of non-existent symbol

#### Python
1. **Module imports** - `import utils`
2. **From imports** - `from utils import foo`
3. **Aliased imports** - `from utils import foo as bar`
4. **Relative imports** - `from .utils import foo`
5. **Local scope imports** - Import inside function

#### Rust
1. **Use statements** - `use utils::foo;`
2. **Aliased imports** - `use utils::foo as bar;`
3. **Nested paths** - `use utils::{foo, bar};`

### Integration Tests

1. **Lazy resolution** - Resolver not called until symbol referenced
2. **Cache effectiveness** - Second reference uses cached result
3. **Re-export chains** - Multi-hop resolution works
4. **Circular imports** - Handled gracefully without infinite loops
5. **Scoped imports** - Non-module-level imports resolve correctly

### Performance Tests

1. **Unused imports** - Measure that unused imports are never resolved
2. **Cache hit rate** - Track cache effectiveness (expect 80%+)
3. **Large re-export chains** - 10+ hops should work

## Success Criteria

### Functional
- ✅ Import specs extracted from any scope level
- ✅ Resolver functions created (not invoked during build)
- ✅ Export chains followed lazily when invoked
- ✅ Cycle detection prevents infinite loops
- ✅ All 4 languages supported
- ✅ Unused imports never resolved

### Testing
- ✅ Unit tests for all import types per language
- ✅ Integration tests prove lazy behavior
- ✅ Performance tests show unused imports cost nothing

### Code Quality
- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ Clear error handling
- ✅ Cycle detection included

## Technical Notes

### Why Lazy Resolution?

**Traditional approach (pre-compute):**
- Resolve ALL imports upfront: 1000 files × 20 imports = 20,000 resolutions
- But only ~2,000 imported symbols actually used
- Wasted: 18,000 resolutions (90%)

**Lazy approach:**
- Create 20,000 resolver functions (~100 bytes each = 2MB)
- Resolve only 2,000 when referenced
- Saved: 90% of resolution work

### Namespace Imports

```typescript
import * as utils from './utils';
utils.helper();
```

Namespace imports require special handling:
1. Resolver returns a "namespace object" (not a symbol_id)
2. Member access requires secondary lookup
3. Future work: Task 11.109.10 (Namespace Import Support)

For initial implementation: Return `null` for namespace imports.

### Default Exports

```typescript
// source.ts
export default function foo() {}

// target.ts
import something from './source';
```

Default exports are found by checking `is_default` flag in export metadata.

## Known Limitations

1. **Namespace imports** - Not supported (return null)
2. **Star exports** - `export * from './utils'` not handled
3. **Dynamic imports** - Runtime `import()` ignored
4. **Type-only imports** - TypeScript type imports treated as regular imports
5. **Node modules** - External packages not resolved
6. **Path aliases** - `@/utils` requires additional configuration

## Dependencies

**Uses:**
- `SemanticIndex` for definitions and imports
- `SymbolAvailability` for export checking
- Path resolution utilities

**Consumed by:**
- Task 11.109.1 `ScopeResolverIndex` (calls `extract_import_specs` and creates resolvers)

## Next Steps

After completion:
- ScopeResolverIndex integrates import resolvers into scope resolver maps
- Import resolution happens on-demand during call resolution
- Cache provides O(1) lookups for repeated imports
- Future: Namespace imports (task 11.109.10)
- Future: Full module resolution with node_modules and aliases
