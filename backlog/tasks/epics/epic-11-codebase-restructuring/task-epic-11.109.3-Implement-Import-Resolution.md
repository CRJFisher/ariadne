# Task 11.109.3: Implement Lazy Import Resolution

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 6-8 days (increased due to language-specific module resolvers)
**Parent:** task-epic-11.109
**Dependencies:** task-epic-11.109.0 (File Structure)

## Files to Create

This task creates MULTIPLE files (main logic + language-specific module resolvers):

**Main import resolution:**
- `packages/core/src/resolve_references/import_resolution/import_resolver.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.test.ts`

**Language-specific module resolution:**
- `packages/core/src/resolve_references/import_resolution/import_resolver.javascript.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.javascript.test.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.typescript.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.typescript.test.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.python.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.rust.ts`
- `packages/core/src/resolve_references/import_resolution/import_resolver.rust.test.ts`

## Objective

Implement lazy import resolution that creates resolver functions for imported symbols. These resolvers are invoked on-demand when an imported symbol is first referenced, following export chains only when needed. This eliminates pre-computing unused import resolutions.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── import_resolution/
    ├── import_resolver.ts
    └── import_resolver.test.ts
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
  local_name: SymbolName; // Name used in importing file
  source_file: FilePath; // Resolved target file path
  import_name: SymbolName; // Name to look up in source file
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
    const source_file = resolve_module_path(import_def.import_path, file_path);

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

/**
 * IMPORTANT: Export Detection Validation Required
 *
 * During implementation, we must validate that the availability values used here
 * correctly identify exported symbols:
 *
 * Questions to answer:
 * 1. Are "file-export" and "public" the complete set of export indicators?
 * 2. What about default exports - do they have a different availability value?
 * 3. Are there other scope values that indicate exportability we're missing?
 * 4. Is availability consistently set during indexing for all languages?
 * 5. Do re-exports have special availability markers?
 *
 * Validation approach:
 * - Create test fixtures with explicit exports in all 4 languages
 * - Verify availability.scope values match expectations
 * - Check edge cases: default exports, re-exports, conditional exports
 * - Document any gaps or inconsistencies found
 * - Update is_exported() logic if needed based on findings
 *
 * If availability is found to be unreliable, we may need to:
 * - Parse export statements directly from the AST
 * - Enhance the indexing phase to set availability more reliably
 * - File bugs/tasks for fixing availability in the indexing system
 */
```

### Module Path Resolution (Language-Specific)

Module resolution is fundamentally language-specific. Each language has different rules for resolving import paths to actual file paths.

**Dispatcher:**

```typescript
import { resolve_module_path_javascript } from "./import_resolver.javascript";
import { resolve_module_path_typescript } from "./import_resolver.typescript";
import { resolve_module_path_python } from "./import_resolver.python";
import { resolve_module_path_rust } from "./import_resolver.rust";

/**
 * Resolve import path to absolute file path (language-aware)
 */
function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language
): FilePath {
  switch (language) {
    case "javascript":
      return resolve_module_path_javascript(import_path, importing_file);
    case "typescript":
      return resolve_module_path_typescript(import_path, importing_file);
    case "python":
      return resolve_module_path_python(import_path, importing_file);
    case "rust":
      return resolve_module_path_rust(import_path, importing_file);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
```

## Language-Specific Module Resolution

### JavaScript Module Resolution (`import_resolver.javascript.ts`)

**Rules:**
1. Relative imports: `./utils`, `../helpers`
2. Extensions: `.js`, `.mjs`, `.cjs`
3. Index files: `/index.js`, `/index.mjs`
4. Package.json: `"main"`, `"exports"` fields (future)
5. Node modules: `node_modules/` lookup (future)

**Implementation:**

```typescript
import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

export function resolve_module_path_javascript(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_javascript(import_path, importing_file);
  }

  // Bare imports (future: node_modules)
  // For now, treat as opaque path
  return import_path as FilePath;
}

function resolve_relative_javascript(
  relative_path: string,
  base_file: FilePath
): FilePath {
  const base_dir = path.dirname(base_file);
  const resolved = path.resolve(base_dir, relative_path);

  // Try extensions in order
  const candidates = [
    resolved,
    `${resolved}.js`,
    `${resolved}.mjs`,
    `${resolved}.cjs`,
    path.join(resolved, "index.js"),
    path.join(resolved, "index.mjs"),
    path.join(resolved, "index.cjs"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate as FilePath;
    }
  }

  // Return resolved path even if not found (may be generated)
  return resolved as FilePath;
}
```

**Tests:**
- Relative imports with explicit extension
- Relative imports without extension (tries .js, .mjs, .cjs)
- Directory imports (tries index.js)
- Non-existent paths (returns resolved path)

### TypeScript Module Resolution (`import_resolver.typescript.ts`)

**Rules:**
1. Relative imports: `./utils`, `../helpers`
2. Extensions: `.ts`, `.tsx`, `.js`, `.jsx` (JS for type-only imports)
3. Index files: `/index.ts`, `/index.tsx`
4. Declaration files: `.d.ts` (future)
5. Path aliases: `@/*`, `~/*` from tsconfig.json (future)
6. Node resolution: node_modules/@types (future)

**Implementation:**

```typescript
import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

export function resolve_module_path_typescript(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_typescript(import_path, importing_file);
  }

  // Path aliases (future: read tsconfig.json)
  // Bare imports (future: node_modules/@types)

  return import_path as FilePath;
}

function resolve_relative_typescript(
  relative_path: string,
  base_file: FilePath
): FilePath {
  const base_dir = path.dirname(base_file);
  const resolved = path.resolve(base_dir, relative_path);

  // Try TypeScript extensions first, then JavaScript
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,  // For JS libraries with types
    `${resolved}.jsx`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate as FilePath;
    }
  }

  return resolved as FilePath;
}
```

**Tests:**
- TypeScript files (.ts, .tsx)
- JavaScript files in TypeScript project
- Index file resolution
- Path aliases (mock tsconfig.json)

### Python Module Resolution (`import_resolver.python.ts`)

**Rules:**
1. Relative imports: `from .utils import`, `from ..helpers import`
2. Absolute imports: `from package.module import`
3. Extensions: `.py`
4. Package markers: `__init__.py`
5. PYTHONPATH (future)
6. Site-packages (future)

**Implementation:**

```typescript
import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

export function resolve_module_path_python(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Relative imports: ".module", "..module"
  if (import_path.startsWith(".")) {
    return resolve_relative_python(import_path, importing_file);
  }

  // Absolute imports: "package.module.submodule"
  return resolve_absolute_python(import_path, importing_file);
}

function resolve_relative_python(
  relative_path: string,
  base_file: FilePath
): FilePath {
  const base_dir = path.dirname(base_file);

  // Count leading dots
  const dots = relative_path.match(/^\.+/)?.[0].length || 0;
  const module_path = relative_path.slice(dots);

  // Go up 'dots-1' directories (one dot = same dir, two dots = parent)
  let target_dir = base_dir;
  for (let i = 1; i < dots; i++) {
    target_dir = path.dirname(target_dir);
  }

  // Convert module path to file path
  const file_path = path.join(target_dir, ...module_path.split("."));

  // Try as file or package
  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate as FilePath;
    }
  }

  return `${file_path}.py` as FilePath;
}

function resolve_absolute_python(
  absolute_path: string,
  base_file: FilePath
): FilePath {
  // For project-local imports, search from project root
  // Find project root by looking for __init__.py
  const base_dir = path.dirname(base_file);
  const project_root = find_python_project_root(base_dir);

  // Convert dotted path to file path
  const file_path = path.join(project_root, ...absolute_path.split("."));

  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate as FilePath;
    }
  }

  return `${file_path}.py` as FilePath;
}

function find_python_project_root(start_dir: string): string {
  // Walk up until we find a directory without __init__.py
  let current = start_dir;
  let last_package_dir = start_dir;

  while (true) {
    const init_file = path.join(current, "__init__.py");
    if (!fs.existsSync(init_file)) {
      return last_package_dir;
    }
    last_package_dir = current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return last_package_dir;
}
```

**Tests:**
- Relative imports: `.sibling`, `..parent.module`
- Absolute imports: `package.module.submodule`
- Package imports: `from package import` → `package/__init__.py`
- Module files vs packages

### Rust Module Resolution (`import_resolver.rust.ts`)

**Rules:**
1. Use statements: `use crate::module;`, `use super::sibling;`
2. Module hierarchy: `mod.rs`, inline `mod` declarations
3. Extensions: `.rs`
4. Crate root: `lib.rs` or `main.rs`
5. External crates: `Cargo.toml` dependencies (future)

**Implementation:**

```typescript
import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

export function resolve_module_path_rust(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Parse use path: "crate::module::submodule"
  const parts = import_path.split("::");

  if (parts[0] === "crate") {
    // Absolute from crate root
    return resolve_from_crate_root(parts.slice(1), importing_file);
  } else if (parts[0] === "super") {
    // Relative to parent module
    return resolve_from_parent(parts.slice(1), importing_file);
  } else if (parts[0] === "self") {
    // Current module
    return resolve_from_current(parts.slice(1), importing_file);
  } else {
    // External crate (future: Cargo.toml resolution)
    return import_path as FilePath;
  }
}

function resolve_from_crate_root(
  module_parts: string[],
  base_file: FilePath
): FilePath {
  const crate_root = find_rust_crate_root(base_file);
  return resolve_rust_module_path(crate_root, module_parts);
}

function resolve_from_parent(
  module_parts: string[],
  base_file: FilePath
): FilePath {
  const current_dir = path.dirname(base_file);
  const parent_dir = path.dirname(current_dir);
  return resolve_rust_module_path(parent_dir, module_parts);
}

function resolve_from_current(
  module_parts: string[],
  base_file: FilePath
): FilePath {
  const current_dir = path.dirname(base_file);
  return resolve_rust_module_path(current_dir, module_parts);
}

function resolve_rust_module_path(
  base_dir: string,
  module_parts: string[]
): FilePath {
  let current_path = base_dir;

  for (let i = 0; i < module_parts.length; i++) {
    const part = module_parts[i];
    const is_last = i === module_parts.length - 1;

    // Try module file or module directory
    const candidates = [
      path.join(current_path, `${part}.rs`),
      path.join(current_path, part, "mod.rs"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        if (is_last) {
          return candidate as FilePath;
        } else {
          // Continue into subdirectory
          current_path = path.dirname(candidate);
          break;
        }
      }
    }
  }

  // Fallback
  return path.join(base_dir, `${module_parts.join("/")}.rs`) as FilePath;
}

function find_rust_crate_root(start_file: FilePath): string {
  let current = path.dirname(start_file);

  while (true) {
    // Look for lib.rs or main.rs
    if (
      fs.existsSync(path.join(current, "lib.rs")) ||
      fs.existsSync(path.join(current, "main.rs"))
    ) {
      return current;
    }

    // Look for Cargo.toml
    if (fs.existsSync(path.join(current, "Cargo.toml"))) {
      // Check for src/ directory
      const src_dir = path.join(current, "src");
      if (fs.existsSync(src_dir)) {
        return src_dir;
      }
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.dirname(start_file);
}
```

**Tests:**
- `crate::` absolute paths
- `super::` relative to parent
- `self::` relative to current
- Module files vs mod.rs
- Crate root detection (lib.rs, main.rs, Cargo.toml)

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
    const resolver = create_import_resolver(spec, indices);
    resolvers.set(spec.local_name, resolver);
  }
}

function create_import_resolver(
  spec: ImportSpec,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolResolver {
  return () => {
    // Runs on-demand when first referenced
    return resolve_export_chain(spec.source_file, spec.import_name, indices);
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

### Core Import Resolution Tests (`import_resolver.test.ts`)

#### Core Functionality

1. **Extract import specs** - Parse import statements into specs
2. **Find exports** - Locate exported symbols in target file
3. **Follow re-export chain** - A exports from B exports from C
4. **Cycle detection** - A re-exports from B re-exports from A
5. **Language dispatch** - Correct module resolver called per language

#### Import Types (Language-Agnostic)

1. **Named imports** - `import { foo } from './utils'`
2. **Aliased imports** - `import { foo as bar } from './utils'`
3. **Default imports** - `import foo from './utils'`
4. **Re-exports** - `export { foo } from './utils'`
5. **Missing exports** - Import of non-existent symbol

### Language-Specific Module Resolution Tests

#### JavaScript (`import_resolver.javascript.test.ts`)

1. **Relative imports with extension** - `./utils.js` → finds exact file
2. **Relative imports without extension** - `./utils` → tries `.js`, `.mjs`, `.cjs`
3. **Index files** - `./utils` → tries `utils/index.js`
4. **Module variants** - `.mjs` (ESM), `.cjs` (CommonJS)
5. **Non-existent files** - Returns resolved path (for generated files)
6. **Nested directories** - `../../helpers/utils`

#### TypeScript (`import_resolver.typescript.test.ts`)

1. **TypeScript files** - `./utils` → tries `.ts`, `.tsx`
2. **JavaScript in TypeScript** - `./helper` → tries `.js`, `.jsx` (for JS libs)
3. **Index files** - `./utils` → tries `utils/index.ts`, `utils/index.tsx`
4. **Extension priority** - TS extensions tried before JS extensions
5. **Declaration files** - `.d.ts` handling (future)
6. **Path aliases** - `@/utils` resolution (future with tsconfig.json)

#### Python (`import_resolver.python.test.ts`)

1. **Relative imports** - `from .sibling import foo` → `sibling.py`
2. **Parent imports** - `from ..parent import bar` → `../parent.py`
3. **Multi-level relative** - `from ...grandparent.module import`
4. **Absolute imports** - `from package.module import` → finds from project root
5. **Package imports** - `from package import` → `package/__init__.py`
6. **Mixed module/package** - Module file vs package directory
7. **Project root detection** - Finds top of package hierarchy

#### Rust (`import_resolver.rust.test.ts`)

1. **Crate absolute paths** - `use crate::module::submodule;`
2. **Super relative paths** - `use super::sibling;`
3. **Self relative paths** - `use self::local;`
4. **Module files** - `utils` → `utils.rs`
5. **Module directories** - `utils` → `utils/mod.rs`
6. **Crate root detection** - Finds `lib.rs`, `main.rs`, or `Cargo.toml`
7. **Nested modules** - `use crate::a::b::c;` → `a/b/c.rs` or `a/b/c/mod.rs`
8. **External crates** - Returns opaque path (future: Cargo.toml resolution)

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
- ✅ All 4 languages supported for import resolution
- ✅ All 4 languages have working module path resolution
- ✅ Unused imports never resolved
- ✅ Language-specific module resolution rules correctly implemented

### Testing

- ✅ Core import resolution tests (export chains, lazy behavior)
- ✅ JavaScript module resolution tests (all extensions and index files)
- ✅ TypeScript module resolution tests (TS/JS extensions, index files)
- ✅ Python module resolution tests (relative/absolute, packages, __init__.py)
- ✅ Rust module resolution tests (crate/super/self, mod.rs, crate root)
- ✅ Integration tests prove lazy behavior
- ✅ Performance tests show unused imports cost nothing

### Code Quality

- ✅ Pythonic naming convention
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
import * as utils from "./utils";
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
import something from "./source";
```

Default exports are found by checking `is_default` flag in export metadata.

## Known Limitations

1. **Namespace imports** - Not supported (return null)
2. **Star exports** - `export * from './utils'` not handled
3. **Dynamic imports** - Runtime `import()` ignored
4. **Type-only imports** - TypeScript type imports treated as regular imports
5. **Node modules** - External packages not resolved
6. **Path aliases** - `@/utils` requires additional configuration
7. **Availability lacks scope context** - Current availability system doesn't account for *where* a symbol is referenced from. See **task-epic-11.110** for comprehensive scope-aware availability refactor.

## Dependencies

**Uses:**

- `SemanticIndex` for definitions and imports
- `SymbolAvailability` for export checking
- Path resolution utilities

**Consumed by:**
- Task 11.109.1 `ScopeResolverIndex` (calls `extract_import_specs` and creates resolvers)
- Task 11.109.8 (Main orchestration)

## Next Steps

After completion:
- ScopeResolverIndex integrates import resolvers into scope resolver maps
- Import resolution happens on-demand during call resolution
- Cache provides O(1) lookups for repeated imports
- Future: **task-epic-11.110** - Scope-aware availability system (makes availability context-aware)
- Future: Namespace imports (task 11.109.10)
- Future: Full module resolution with node_modules and aliases
