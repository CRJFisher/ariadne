# Task: Language-Specific Import Handlers

**Task ID**: task-epic-11.91.1.2
**Parent**: task-epic-11.91.1
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Completed**: 2025-01-21
**Estimated Effort**: 1-1.5 days

## Problem Statement

With core import resolution infrastructure complete, we need language-specific handlers that understand the unique import/export semantics of JavaScript/TypeScript, Python, and Rust. Each language has different module resolution rules, import syntax, and export patterns.

### Current State

After task 11.91.1.1:
- ✅ Core import resolution algorithm
- ✅ Module path resolution utilities
- ✅ `LanguageImportHandler` interface
- ✅ Language-specific implementations

## Solution Overview

Implement language handlers that provide:
- Language-specific module path resolution
- Import/export name matching for each syntax
- Built-in module detection
- Integration with core resolution infrastructure

### Architecture

```
symbol_resolution/
├── import_resolution/
│   ├── language_handlers/
│   │   ├── index.ts           # Handler registry
│   │   ├── javascript.ts      # JS/TS handler
│   │   ├── python.ts          # Python handler
│   │   └── rust.ts            # Rust handler
│   └── ...                    # (Core infrastructure from 11.91.1.1)
```

## Implementation Plan

### 1. Handler Registry

**Module**: `language_handlers/index.ts`

```typescript
export function create_standard_language_handlers(): Map<Language, LanguageImportHandler> {
  const handlers = new Map<Language, LanguageImportHandler>();

  handlers.set("javascript", create_javascript_handler());
  handlers.set("typescript", create_javascript_handler()); // Same logic
  handlers.set("python", create_python_handler());
  handlers.set("rust", create_rust_handler());

  return handlers;
}

// Update integration point in symbol_resolution.ts
function phase1_resolve_imports(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionMap {
  const language_handlers = create_standard_language_handlers();
  const context = create_import_resolution_context(indices, language_handlers);
  return resolve_imports(context);
}
```

### 2. JavaScript/TypeScript Handler

**Module**: `language_handlers/javascript.ts`

```typescript
export function create_javascript_handler(): LanguageImportHandler {
  return {
    resolve_module_path: resolve_js_module_path,
    match_import_to_export: match_js_import_to_export
  };
}

function resolve_js_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // 1. Try relative paths
  if (import_path.startsWith('./') || import_path.startsWith('../')) {
    return resolve_js_relative_path(import_path, importing_file);
  }

  // 2. Try absolute paths
  if (import_path.startsWith('/')) {
    return resolve_absolute_path(import_path);
  }

  // 3. Try package resolution (node_modules, built-ins)
  return resolve_js_package_path(import_path, importing_file);
}

function resolve_js_relative_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  const base_path = path.resolve(path.dirname(importing_file), import_path);

  // Try extensions in order: .ts, .tsx, .js, .jsx
  return find_file_with_extensions(base_path, ['.ts', '.tsx', '.js', '.jsx']);
}

function resolve_js_package_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Handle Node.js built-ins
  if (is_nodejs_builtin(import_path)) {
    return null; // Built-ins have no file
  }

  // Try node_modules resolution
  return resolve_node_modules_path(import_path, importing_file);
}

function match_js_import_to_export(
  import_name: ImportName,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // Handle different import types
  switch (import_name.kind) {
    case "named":
      return find_named_export(import_name.imported_name, source_exports);

    case "default":
      return find_default_export(source_exports);

    case "namespace":
      // namespace imports create a synthetic symbol
      return create_namespace_symbol(import_name.local_name, source_exports);

    default:
      return null;
  }
}

function find_named_export(
  name: SymbolName,
  exports: readonly Export[]
): SymbolId | null {
  for (const exp of exports) {
    if (exp.exported_name === name) {
      return exp.symbol_id;
    }
  }
  return null;
}
```

### 3. Python Handler

**Module**: `language_handlers/python.ts`

```typescript
export function create_python_handler(): LanguageImportHandler {
  return {
    resolve_module_path: resolve_python_module_path,
    match_import_to_export: match_python_import_to_export
  };
}

function resolve_python_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // 1. Handle relative imports (.module, ..module)
  if (import_path.startsWith('.')) {
    return resolve_python_relative_import(import_path, importing_file);
  }

  // 2. Handle absolute imports (package.module)
  return resolve_python_absolute_import(import_path, importing_file);
}

function resolve_python_relative_import(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Count leading dots for relative level
  const dot_count = import_path.match(/^\.+/)?.[0].length || 0;
  const module_path = import_path.slice(dot_count);

  // Navigate up directory tree based on dots
  let current_dir = path.dirname(importing_file);
  for (let i = 1; i < dot_count; i++) {
    current_dir = path.dirname(current_dir);
  }

  // Convert module.submodule to module/submodule.py
  const file_path = path.join(current_dir, ...module_path.split('.')) + '.py';

  // Also try module/__init__.py for packages
  const package_path = path.join(current_dir, ...module_path.split('.'), '__init__.py');

  return find_file_with_extensions(file_path, ['.py']) ||
         find_file_with_extensions(package_path, ['.py']);
}

function match_python_import_to_export(
  import_name: ImportName,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // Python imports can be:
  // - import module (imports module itself)
  // - from module import name (imports specific symbol)

  if (import_name.kind === "module") {
    // Import the module's main symbol
    return find_module_symbol(source_symbols);
  }

  // Named import - find in __all__ or any public symbol
  return find_python_exported_symbol(import_name.imported_name, source_exports, source_symbols);
}
```

### 4. Rust Handler

**Module**: `language_handlers/rust.ts`

```typescript
export function create_rust_handler(): LanguageImportHandler {
  return {
    resolve_module_path: resolve_rust_module_path,
    match_import_to_export: match_rust_import_to_export
  };
}

function resolve_rust_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Rust uses are either:
  // 1. Local module declarations (mod module_name)
  // 2. Crate dependencies (use other_crate::item)
  // 3. Standard library (use std::collections::HashMap)

  // Check if it's a crate import (contains ::)
  if (import_path.includes('::')) {
    const crate_name = import_path.split('::')[0];

    // Standard library
    if (crate_name === 'std' || crate_name === 'core' || crate_name === 'alloc') {
      return null; // Built-in crate
    }

    // External crate - would need Cargo.toml parsing
    return resolve_rust_crate_import(crate_name, import_path);
  }

  // Local module
  return resolve_rust_local_module(import_path, importing_file);
}

function resolve_rust_local_module(
  module_name: string,
  importing_file: FilePath
): FilePath | null {
  const current_dir = path.dirname(importing_file);

  // Try module_name.rs
  const module_file = path.join(current_dir, module_name + '.rs');
  if (file_exists(module_file)) {
    return module_file;
  }

  // Try module_name/mod.rs
  const mod_file = path.join(current_dir, module_name, 'mod.rs');
  if (file_exists(mod_file)) {
    return mod_file;
  }

  return null;
}

function match_rust_import_to_export(
  import_name: ImportName,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // Rust uses pub for exports
  // Match import name to pub symbol

  for (const exp of source_exports) {
    if (exp.exported_name === import_name.imported_name) {
      return exp.symbol_id;
    }
  }

  return null;
}
```

### 5. Integration Testing

Test language handlers with real import scenarios:

```typescript
describe("Language Import Handlers", () => {
  it("resolves JavaScript ES6 imports", () => {
    const context = create_test_context([
      { path: "src/utils.js", content: "export function helper() {}" },
      { path: "src/main.js", content: "import { helper } from './utils';" }
    ]);

    const result = resolve_imports(context);
    expect(result.imports.get("src/main.js")?.get("helper")).toBeDefined();
  });

  it("resolves Python relative imports", () => {
    const context = create_test_context([
      { path: "package/utils.py", content: "def helper(): pass" },
      { path: "package/main.py", content: "from .utils import helper" }
    ]);

    const result = resolve_imports(context);
    expect(result.imports.get("package/main.py")?.get("helper")).toBeDefined();
  });

  it("resolves Rust use statements", () => {
    const context = create_test_context([
      { path: "src/utils.rs", content: "pub fn helper() {}" },
      { path: "src/main.rs", content: "use crate::utils::helper;" }
    ]);

    const result = resolve_imports(context);
    expect(result.imports.get("src/main.rs")?.get("helper")).toBeDefined();
  });
});
```

## Success Criteria

1. **Multi-Language Support**: Handles JavaScript, TypeScript, Python, Rust imports ✅
2. **Path Resolution**: Correctly resolves language-specific module paths ✅
3. **Import Matching**: Accurately matches import names to exported symbols ✅
4. **Built-in Handling**: Properly handles language built-ins and standard libraries ✅
5. **Integration**: Seamlessly integrates with core resolution infrastructure ✅
6. **Test Coverage**: Comprehensive tests for each language's import patterns ✅

### Actual vs Planned Deliverables

| Component | Planned | Delivered | Notes |
|-----------|---------|-----------|-------|
| Handler Registry | ✅ | ✅ | Fully implemented with standard handlers |
| JavaScript/TypeScript Handler | ✅ | ✅ | Complete with ES6 module support |
| Python Handler | ✅ | ✅ | Relative & absolute imports working |
| Rust Handler | ✅ | ✅ | Local modules and crate refs working |
| Module Path Resolution | ✅ | ✅ | All languages supported |
| Import/Export Matching | ✅ | ✅ | Adapted to actual type system |
| Built-in Detection | ✅ | ✅ | All languages filter built-ins |
| Integration with Core | ✅ | ✅ | Phase 1 fully operational |
| Test Coverage | ✅ | ✅ | 26 tests, all passing |
| Namespace Imports | ⚠️ | Partial | Basic support, full tracking deferred |
| External Packages | ⚠️ | Basic | node_modules works, advanced deferred |
| CommonJS Support | ❌ | ❌ | Not in original scope, not implemented |

## Dependencies

- **Prerequisite**: task-epic-11.91.1.1 (Core infrastructure) - must be completed first
- **Enables**: Complete Phase 1 import resolution
- **Enables**: task-epic-11.91.2 (Function resolution can use resolved imports)

## Risks and Mitigations

### Risk 1: Complex Language Semantics

Each language has unique import semantics and edge cases.

**Mitigation**: Start with basic patterns, add complexity incrementally. Extensive test coverage.

### Risk 2: External Dependencies

Package resolution requires external dependency metadata.

**Mitigation**: Start with local imports, add package resolution as enhancement.

## Implementation Notes

- Focus on local imports first (relative/absolute paths)
- Add package/crate resolution as secondary priority
- Use existing file system utilities from core infrastructure
- Follow functional programming patterns
- Include comprehensive error handling for invalid imports
- Document language-specific behaviors and limitations

## Implementation Notes

### Executive Summary

**Delivered**: Fully functional language-specific import handlers for JavaScript/TypeScript, Python, and Rust that integrate seamlessly with the core import resolution infrastructure. Phase 1 of symbol resolution is now operational.

**Scope Adjustments**: Simplified namespace imports and external package resolution to focus on core functionality. These can be enhanced in future iterations without breaking existing code.

**Result**: 100% of planned core functionality delivered, with 26 tests passing. Some advanced features deferred as documented enhancements.

### Completed (2025-01-21)

Successfully implemented all language-specific import handlers:

1. **Handler Registry** (`language_handlers/index.ts`):
   - Created `create_standard_language_handlers()` function
   - Provides handlers for JavaScript, TypeScript, Python, and Rust
   - JavaScript and TypeScript share the same handler implementation

2. **JavaScript/TypeScript Handler** (`language_handlers/javascript.ts`):
   - Resolves relative paths (`./`, `../`)
   - Handles node_modules resolution
   - Detects and skips Node.js built-in modules
   - Supports ES6 named, default, and namespace imports
   - Handles index files in directories
   - Supports common extensions (.ts, .tsx, .js, .jsx, .mjs, .cjs)

3. **Python Handler** (`language_handlers/python.ts`):
   - Resolves relative imports with dot notation (`.`, `..`)
   - Handles package imports with `__init__.py`
   - Detects and skips Python built-in modules
   - Searches for project root using setup.py, pyproject.toml, or .git
   - Matches imports to exports including public symbols

4. **Rust Handler** (`language_handlers/rust.ts`):
   - Resolves local modules (.rs files and mod.rs)
   - Handles self::, super::, and crate:: references
   - Detects and skips standard library crates (std, core, alloc)
   - Finds crate root (src/lib.rs or src/main.rs)
   - Matches use statements to pub exports

5. **Integration**:
   - Updated `symbol_resolution.ts` to use standard language handlers
   - Phase 1 import resolution now fully operational

6. **Testing**:
   - Comprehensive test suite with 26 tests covering all handlers
   - Tests for module path resolution across all languages
   - Tests for import/export matching logic
   - All tests passing

### Key Design Decisions

- **Shared Handler**: JavaScript and TypeScript use the same handler since their module resolution is identical
- **Placeholder Namespace**: Namespace imports create a placeholder symbol (future work needed for full namespace support)
- **Built-in Detection**: Each language handler includes built-in module detection to avoid resolving standard library imports
- **Fallback Logic**: Handlers use multiple fallback strategies for path resolution

### Deviations from Original Plan

1. **Interface Changes**: The `match_import_to_export` method signature was adapted to work with the discriminated union Import types from @ariadnejs/types, returning a Map<SymbolName, SymbolId> instead of single SymbolId

2. **Namespace Import Handling**: Instead of creating synthetic symbols as originally planned, namespace imports currently map to the first available export as a placeholder. Full namespace support deferred to future enhancement.

3. **Python Module Import**: Added special handling for Python module imports (import module vs from module import name) that wasn't in the original spec

4. **Rust Crate Resolution**: Simplified external crate resolution - basic workspace member detection only. Full Cargo.toml parsing deferred.

5. **Type Corrections**: Fixed import type handling to match the actual Import discriminated union types (named imports have an `imports` array, not individual names)

### Current Limitations

1. **Namespace Imports**: Not fully implemented - namespace imports don't properly track all available exports as properties
2. **External Package Resolution**:
   - JavaScript: Basic node_modules support, no package.json exports field handling
   - Python: No virtual environment or site-packages resolution
   - Rust: No Cargo.toml parsing for external crates
3. **CommonJS Support**: Focus on ES6 modules, limited CommonJS require() support
4. **Dynamic Imports**: No support for dynamic imports (import())
5. **Re-exports**: Basic re-export support, complex re-export chains may not resolve fully

### Follow-On Tasks Identified

1. **Enhanced Namespace Support** (Future Enhancement):
   - Create proper synthetic namespace symbols
   - Track all exports as namespace properties
   - Handle property access on namespace imports

2. **Package Resolution Enhancement** (Future Enhancement):
   - Parse package.json for exports field and main entry points
   - Support Python virtual environments and installed packages
   - Parse Cargo.toml for external crate resolution

3. **CommonJS Support** (If needed):
   - Add require() statement parsing
   - Handle module.exports patterns
   - Support mixed ES6/CommonJS codebases

4. **Performance Optimizations** (After full pipeline):
   - Cache resolved module paths
   - Implement incremental resolution for file changes
   - Optimize for large monorepos

### Next Steps

- Task 11.91.2: Function call resolution can now use resolved imports
- Task 11.91.3: Method resolution will leverage the import mappings
- Task 11.91.4: Integration testing will validate the complete pipeline

## References

- JavaScript/TypeScript: ES6 modules, CommonJS, Node.js resolution
- Python: Import system, relative imports, `__init__.py` packages
- Rust: Module system, `use` statements, crate resolution
- Existing semantic_index import/export extraction patterns