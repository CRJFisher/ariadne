# Task: Implement Import/Export Resolution Infrastructure

**Task ID**: task-epic-11.91.1
**Parent**: task-epic-11.91
**Status**: Created
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 2-3 days

## Problem Statement

Phase 1 of the symbol resolution pipeline is currently unimplemented, preventing cross-file symbol mapping. Import/export resolution is the foundation for all cross-file call resolution.

### Current State

```typescript
// symbol_resolution.ts - Phase 1 is a stub
function phase1_resolve_imports(
  _indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionMap {
  const imports = new Map<FilePath, Map<SymbolName, SymbolId>>();
  // TODO: Implementation
  return { imports };
}
```

The semantic_index already extracts import/export information but symbol resolution doesn't process it.

## Solution Overview

Implement a comprehensive import/export resolution system that maps imported symbol names to their source definitions across all supported languages.

### Architecture

```
symbol_resolution/
├── import_resolution/
│   ├── index.ts              # Public API
│   ├── import_resolver.ts    # Main resolution logic
│   ├── module_resolver.ts    # Path resolution
│   ├── import_types.ts       # Type definitions
│   └── language_handlers/    # Language-specific logic
│       ├── javascript.ts     # JS/TS imports
│       ├── python.ts         # Python imports
│       └── rust.ts           # Rust imports
```

## Implementation Plan

### 1. Core Infrastructure

**Module**: `import_resolution/import_types.ts`

Define resolution data structures:

```typescript
interface ImportResolution {
  imported_name: SymbolName;
  source_symbol_id: SymbolId;
  source_file: FilePath;
  import_kind: "named" | "default" | "namespace" | "star";
}

interface ModuleResolution {
  import_path: string;
  resolved_file: FilePath;
  resolution_method: "relative" | "absolute" | "node_modules" | "builtin";
}
```

### 2. Module Path Resolution

**Module**: `import_resolution/module_resolver.ts`

Handle different import path resolution strategies:

- **Relative imports**: `./module`, `../utils`
- **Absolute imports**: `/src/utils`
- **Package imports**: `@scope/package`, `lodash`
- **Built-in modules**: `fs`, `path`, `os`

Language-specific path handling:
- **JavaScript/TypeScript**: Node.js resolution algorithm
- **Python**: sys.path, relative imports, packages
- **Rust**: Cargo.toml dependencies, local modules

### 3. Import/Export Matching

**Module**: `import_resolution/import_resolver.ts`

Core resolution algorithm:

1. **For each file's imports**:
   - Resolve import path to source file
   - Match import names to export names in source
   - Handle import transformations (aliases, destructuring)
   - Build mapping: `imported_name -> source_symbol_id`

2. **Handle different import types**:
   - Named imports: `import { foo } from './module'`
   - Default imports: `import foo from './module'`
   - Namespace imports: `import * as foo from './module'`
   - Re-exports: `export { foo } from './module'`

### 4. Language-Specific Handlers

**JavaScript/TypeScript** (`language_handlers/javascript.ts`):
- ES6 import/export syntax
- CommonJS require/module.exports
- TypeScript path mapping from tsconfig.json
- Node.js module resolution

**Python** (`language_handlers/python.ts`):
- `import module` and `from module import name`
- Relative imports with `.` notation
- Package imports and `__init__.py` handling
- Built-in module detection

**Rust** (`language_handlers/rust.ts`):
- `use` statements and module tree
- Crate dependencies from Cargo.toml
- Local module declarations
- `pub use` re-exports

## Technical Details

### Import Resolution Algorithm

```typescript
function resolve_imports(indices: ReadonlyMap<FilePath, SemanticIndex>): ImportResolutionMap {
  const result = new Map<FilePath, Map<SymbolName, SymbolId>>();

  for (const [file_path, index] of indices) {
    const file_imports = new Map<SymbolName, SymbolId>();

    for (const import_stmt of index.imports) {
      // 1. Resolve import path to source file
      const source_file = resolve_module_path(import_stmt.source, file_path);

      if (source_file && indices.has(source_file)) {
        const source_index = indices.get(source_file)!;

        // 2. Match import names to exports
        for (const import_name of import_stmt.names) {
          const source_symbol = find_exported_symbol(
            import_name,
            source_index.exports,
            source_index.symbols
          );

          if (source_symbol) {
            file_imports.set(import_name.local_name, source_symbol);
          }
        }
      }
    }

    if (file_imports.size > 0) {
      result.set(file_path, file_imports);
    }
  }

  return { imports: result };
}
```

### Module Path Resolution

```typescript
function resolve_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // 1. Try relative path resolution
  if (import_path.startsWith('./') || import_path.startsWith('../')) {
    return resolve_relative_path(import_path, importing_file);
  }

  // 2. Try absolute path resolution
  if (import_path.startsWith('/')) {
    return resolve_absolute_path(import_path);
  }

  // 3. Try package resolution (node_modules, etc.)
  return resolve_package_path(import_path, importing_file);
}
```

## Integration Points

### With Existing Symbol Resolution

Update `symbol_resolution.ts` Phase 1:

```typescript
function phase1_resolve_imports(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionMap {
  return resolve_imports(indices);
}
```

### With Semantic Index

Use existing import/export extraction from semantic_index:

```typescript
// Already available in SemanticIndex
interface SemanticIndex {
  readonly imports: readonly Import[];
  readonly exports: readonly Export[];
}
```

## Testing Strategy

### Unit Tests

- Module path resolution for all languages
- Import/export matching edge cases
- Error handling for missing modules
- Performance tests on large import graphs

### Integration Tests

- Cross-file symbol resolution
- Complex import scenarios (re-exports, circular imports)
- Multi-language project resolution
- Real-world codebase validation

### Test Fixtures

```
fixtures/
├── javascript/
│   ├── basic_imports/
│   ├── circular_imports/
│   └── node_modules_imports/
├── typescript/
│   ├── path_mapping/
│   └── barrel_exports/
├── python/
│   ├── relative_imports/
│   └── package_imports/
└── rust/
    ├── crate_imports/
    └── local_modules/
```

## Success Criteria

1. **Accurate Resolution**: Import names correctly mapped to source symbols
2. **Multi-Language Support**: Works for JavaScript, TypeScript, Python, Rust
3. **Path Resolution**: Handles relative, absolute, and package imports
4. **Performance**: Efficient resolution for large codebases
5. **Error Handling**: Graceful handling of missing or invalid imports
6. **Integration**: Seamlessly integrates with existing symbol resolution pipeline

## Dependencies

- **Prerequisite**: Semantic index import/export extraction (✅ available)
- **Enables**: Phase 2 function resolution, Phase 4 method resolution
- **Related**: File system access for path resolution

## Risks and Mitigations

### Risk 1: Complex Module Resolution

Node.js module resolution is complex with many edge cases.

**Mitigation**: Start with basic relative/absolute paths, add package resolution incrementally.

### Risk 2: Language Differences

Each language has unique import semantics.

**Mitigation**: Modular language handlers allow independent implementation.

### Risk 3: Performance Impact

Import resolution can be expensive for large projects.

**Mitigation**: Cache resolved paths and implement incremental resolution.

## Implementation Notes

- Follow existing codebase patterns (snake_case, functional style)
- Use tree-sitter queries where beneficial
- Maintain type safety with branded types
- Include comprehensive error handling
- Document language-specific behaviors

## References

- Node.js module resolution algorithm
- Python import system documentation
- Rust module system guide
- Existing semantic_index import/export extraction