# Task: Core Import Resolution Infrastructure

**Task ID**: task-epic-11.91.1.1
**Parent**: task-epic-11.91.1
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Completed**: 2025-01-21
**Estimated Effort**: 1-1.5 days
**Actual Effort**: 0.5 days

## Problem Statement

Phase 1 of the symbol resolution pipeline requires foundational infrastructure for import/export resolution. This task implements the core data structures, module path resolution, and main resolution algorithm that will be used by language-specific handlers.

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

## Solution Overview

Build the core import resolution infrastructure that provides:
- Data structures for import mappings
- Module path resolution (relative, absolute, package)
- Core import/export matching algorithm
- Integration points for language-specific handlers

### Architecture

```
symbol_resolution/
├── import_resolution/
│   ├── index.ts              # Public API
│   ├── import_types.ts       # Core type definitions
│   ├── module_resolver.ts    # Path resolution logic
│   ├── import_resolver.ts    # Main resolution algorithm
│   └── language_handlers/    # (Created in 11.91.1.2)
```

## Implementation Plan

### 1. Core Type Definitions

**Module**: `import_resolution/import_types.ts`

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

interface ImportResolutionMap {
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

interface ImportResolutionContext {
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;
  readonly language_handlers: Map<Language, LanguageImportHandler>;
}

interface LanguageImportHandler {
  resolve_module_path(import_path: string, importing_file: FilePath): FilePath | null;
  match_import_to_export(
    import_name: ImportName,
    source_exports: readonly Export[],
    source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
  ): SymbolId | null;
}
```

### 2. Module Path Resolution

**Module**: `import_resolution/module_resolver.ts`

Core path resolution that delegates to language handlers:

```typescript
export function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language,
  context: ImportResolutionContext
): FilePath | null {
  const handler = context.language_handlers.get(language);
  if (!handler) {
    return null;
  }

  return handler.resolve_module_path(import_path, importing_file);
}

// Generic utilities used by language handlers
export function resolve_relative_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Handle ./module, ../utils patterns
  // Return null if path doesn't exist
}

export function resolve_absolute_path(import_path: string): FilePath | null {
  // Handle /src/utils patterns
  // Return null if path doesn't exist
}

export function find_file_with_extensions(
  base_path: string,
  extensions: readonly string[]
): FilePath | null {
  // Try .ts, .js, .py, .rs extensions
  // Return first match or null
}
```

### 3. Core Resolution Algorithm

**Module**: `import_resolution/import_resolver.ts`

Main algorithm that coordinates path resolution and import matching:

```typescript
export function resolve_imports(
  context: ImportResolutionContext
): ImportResolutionMap {
  const result = new Map<FilePath, Map<SymbolName, SymbolId>>();

  for (const [file_path, index] of context.indices) {
    const file_imports = new Map<SymbolName, SymbolId>();

    for (const import_stmt of index.imports) {
      // 1. Resolve import path to source file
      const source_file = resolve_module_path(
        import_stmt.source,
        file_path,
        index.language,
        context
      );

      if (source_file && context.indices.has(source_file)) {
        const source_index = context.indices.get(source_file)!;

        // 2. Match import names to exports using language handler
        const handler = context.language_handlers.get(index.language);
        if (handler) {
          for (const import_name of import_stmt.names) {
            const source_symbol = handler.match_import_to_export(
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
    }

    if (file_imports.size > 0) {
      result.set(file_path, file_imports);
    }
  }

  return { imports: result };
}
```

### 4. Public API

**Module**: `import_resolution/index.ts`

```typescript
export { resolve_imports } from './import_resolver';
export { resolve_module_path } from './module_resolver';
export type {
  ImportResolution,
  ModuleResolution,
  ImportResolutionMap,
  ImportResolutionContext,
  LanguageImportHandler
} from './import_types';

// Factory for creating resolution context
export function create_import_resolution_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  language_handlers: Map<Language, LanguageImportHandler>
): ImportResolutionContext {
  return { indices, language_handlers };
}
```

### 5. Integration with Symbol Resolution

Update `symbol_resolution.ts` Phase 1:

```typescript
function phase1_resolve_imports(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionMap {
  // Language handlers will be provided by task 11.91.1.2
  const language_handlers = new Map<Language, LanguageImportHandler>();
  // TODO: Register handlers when available

  const context = create_import_resolution_context(indices, language_handlers);
  return resolve_imports(context);
}
```

## Testing Strategy

### Unit Tests

- Module path resolution utilities
- Core resolution algorithm with mock handlers
- Error handling for missing files
- Edge cases (circular imports, missing exports)

### Test Fixtures

```
fixtures/
├── path_resolution/
│   ├── relative_imports/
│   ├── absolute_imports/
│   └── missing_files/
└── core_resolution/
    ├── basic_imports/
    ├── circular_imports/
    └── malformed_imports/
```

## Success Criteria

1. **Path Resolution**: Correctly resolves relative, absolute paths
2. **Algorithm Structure**: Clean separation between core logic and language handlers
3. **Error Handling**: Graceful handling of missing files and malformed imports
4. **Integration Ready**: Ready for language handlers in task 11.91.1.2
5. **Test Coverage**: Comprehensive tests for core functionality

## Dependencies

- **Prerequisite**: Semantic index import/export extraction (✅ available)
- **Enables**: task-epic-11.91.1.2 (Language-specific handlers)
- **Blocks**: task-epic-11.91.2 (Function resolution needs import resolution)

## Implementation Notes

- Focus on core infrastructure, defer language-specific logic
- Use dependency injection pattern for language handlers
- Follow existing codebase patterns (snake_case, functional style)
- Include comprehensive error handling and logging
- Design for testability with mock handlers

## References

- Existing semantic_index import/export extraction
- Module resolution patterns from popular tools
- Dependency injection best practices

## Implementation Results

### Completed Components

Successfully implemented all planned core infrastructure:

1. **Core Type Definitions** (`import_types.ts`)
   - All interfaces as specified
   - Added `ImportResolutionContext` for dependency injection
   - `LanguageImportHandler` interface for language-specific logic

2. **Module Path Resolution** (`module_resolver.ts`)
   - `resolve_module_path()` - Main coordinator
   - `resolve_relative_path()` - Handles ./module, ../utils patterns
   - `resolve_absolute_path()` - Handles /src/utils patterns
   - `find_file_with_extensions()` - Tries multiple file extensions
   - **Added**: `resolve_node_modules_path()` - Basic node_modules resolution

3. **Core Resolution Algorithm** (`import_resolver.ts`)
   - `resolve_imports()` - Main import resolution for all files
   - **Added**: `resolve_file_imports()` - Resolve imports for specific file (useful for incremental resolution)
   - **Added**: `get_importing_files()` - Find files importing from a source (useful for impact analysis)

4. **Public API** (`index.ts`)
   - All exports as planned
   - Factory functions for creating contexts
   - Clean separation of concerns

5. **Integration**
   - Updated `symbol_resolution.ts` Phase 1 to use new import resolution
   - Ready for language handlers from task 11.91.1.2

### Implementation Deviations

1. **Interface Changes**:
   - `match_import_to_export()` takes full `Import` object rather than just `ImportName` for more flexibility
   - This allows handlers to access all import metadata (kind, source, modifiers)

2. **Additional Utilities**:
   - Added `resolve_file_imports()` for incremental resolution scenarios
   - Added `get_importing_files()` for dependency analysis
   - Added `resolve_node_modules_path()` for basic package resolution

3. **Testing Approach**:
   - Used mock handlers instead of file fixtures for unit tests
   - Created comprehensive `MockLanguageHandler` class for testing
   - Tests cover all core scenarios with 100% passing

### Test Coverage

✅ All 11 tests passing:
- Named imports resolution
- Default imports resolution
- Namespace import handling
- Side-effect import skipping
- Missing source file handling
- Path resolution utilities
- File-specific import resolution
- Dependency analysis

### Known Limitations

1. **Node modules resolution** is basic - doesn't handle:
   - Complex package.json exports field
   - Conditional exports
   - Subpath exports
   - TypeScript path mappings

2. **Language handlers** are stubbed - actual implementations come in task 11.91.1.2

### Follow-On Work

1. **task-epic-11.91.1.2**: Implement language-specific handlers for:
   - JavaScript/TypeScript
   - Python
   - Rust

2. **Future Enhancements** (not critical for MVP):
   - Advanced node_modules resolution
   - Caching for repeated path resolutions
   - Parallel resolution for large codebases
   - TypeScript path mapping support

### Integration Status

✅ Ready for language handler integration
✅ Phase 1 of symbol_resolution.ts updated
✅ All tests passing
✅ Clean API boundaries established

The core import resolution infrastructure is complete and ready for language-specific implementations.