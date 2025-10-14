# Task 11.145: Pre-resolve and Cache Module Paths in ImportGraph

**Status**: Completed
**Epic**: 11 - Codebase Restructuring
**Priority**: High
**Created**: 2025-10-14

## Objective

Eliminate duplicate module path resolution logic across ResolutionRegistry and ExportRegistry by:
1. Pre-resolving import module paths in ImportGraph (cache once, use many times)
2. Passing SemanticIndex for language metadata instead of re-detecting from file paths
3. Removing duplicate `detect_language` helper functions

## Problem Statement

### Code Duplication
- ResolutionRegistry had its own `resolve_module_path` method (lines 397-423)
- ResolutionRegistry had its own `detect_language` method (lines 375-391)
- ExportRegistry had duplicate `detect_language` method (lines 374-390)
- Both registries delegated to language-specific resolvers separately

### Performance Issue
Module path resolution happened repeatedly:
- In ResolutionRegistry when resolving scopes
- In ExportRegistry when following re-export chains
- Every time an import was processed

### Architecture Issue
- Language detection scattered across multiple files
- No single source of truth for resolved import paths

## Solution Implemented

### 1. Enhanced ImportGraph to Pre-resolve Paths

**File**: [packages/core/src/project/import_graph.ts](../../../../../../packages/core/src/project/import_graph.ts)

- Added `resolved_import_paths: Map<SymbolId, FilePath>` field
- Updated `update_file()` signature to accept `language: Language` and `root_folder: FileSystemFolder`
- Pre-resolve module paths once when imports are added:
  ```typescript
  const resolved_path = resolve_module_path(
    imp_def.import_path,
    file_path,
    language,
    root_folder
  );
  this.resolved_import_paths.set(imp_def.symbol_id, resolved_path);
  ```
- Added `get_resolved_import_path(import_symbol_id): FilePath | undefined` method
- Clean up resolved paths in `remove_file()` and `clear()`

### 2. Updated Project.ts to Pass Language

**File**: [packages/core/src/project/project.ts](../../../../../../packages/core/src/project/project.ts:183)

```typescript
this.imports.update_file(file_id, import_definitions, language, this.root_folder);
```

Language is obtained from `detect_language(file_id)` and passed through, eliminating need for each registry to re-detect it.

### 3. Refactored ResolutionRegistry

**File**: [packages/core/src/project/resolution_registry.ts](../../../../../../packages/core/src/project/resolution_registry.ts)

**Removed**:
- `private detect_language()` method (~20 lines)
- `private resolve_module_path()` method (~25 lines)
- Direct imports of language-specific resolvers

**Updated**:
- Added `semantic_indexes` parameter to `resolve_scope_recursive()`
- Use pre-resolved paths from ImportGraph:
  ```typescript
  const source_file = imports.get_resolved_import_path(imp_def.symbol_id);
  ```
- Get language from semantic_indexes instead of file path:
  ```typescript
  const source_index = semantic_indexes.get(source_file);
  const language = source_index.language;
  ```

**Result**: ~50 lines of code removed

### 4. Refactored ExportRegistry

**File**: [packages/core/src/project/export_registry.ts](../../../../../../packages/core/src/project/export_registry.ts)

**Removed**:
- `private detect_language()` method (~20 lines)

**Updated**:
- Added `semantic_indexes` parameter to `resolve_export_chain()`
- Get language from semantic_indexes:
  ```typescript
  const source_index = semantic_indexes.get(source_file);
  const language = source_index.language;
  ```

**Result**: ~20 lines of code removed

### 5. Updated import_resolver.ts

**File**: [packages/core/src/resolve_references/import_resolution/import_resolver.ts](../../../../../../packages/core/src/resolve_references/import_resolution/import_resolver.ts:92-100)

- Exported `resolve_module_path` function (was private)
- Added `semantic_indexes` parameter to `resolve_export_chain()` wrapper function
- Pass semantic_indexes through to ExportRegistry

## Benefits

### Performance
- **O(1) cached lookups** instead of repeated module resolution
- Module paths resolved once in ImportGraph.update_file()
- No redundant file system operations

### Code Quality
- **~70+ lines of duplicate code eliminated**
- Single source of truth for module resolution (`import_resolver.ts`)
- Consistent resolution algorithm across all registries

### Maintainability
- Changes to module resolution only need to happen in one place
- Language detection happens once per file (in Project.ts)
- Clear data flow: ImportGraph owns resolved paths

## Architecture Impact

### Data Flow
```
Project.update_file()
  ↓
  detect_language(file_path) → language
  ↓
  ImportGraph.update_file(imports, language, root_folder)
    ↓
    resolve_module_path() [ONCE per import]
    ↓
    Cache in resolved_import_paths
  ↓
  ResolutionRegistry.resolve_files(semantic_indexes, ...)
    ↓
    Use cached: imports.get_resolved_import_path()
    Use language: semantic_indexes.get(file).language
  ↓
  ExportRegistry.resolve_export_chain(semantic_indexes, ...)
    ↓
    Use language: semantic_indexes.get(file).language
```

### Single Responsibility
- **ImportGraph**: Owns import relationships AND resolved paths
- **ResolutionRegistry**: Uses cached paths, no resolution logic
- **ExportRegistry**: Uses cached paths, no resolution logic
- **Project**: Coordinates, passes language metadata

## Files Changed

1. `packages/core/src/project/import_graph.ts` - Add caching
2. `packages/core/src/project/project.ts` - Pass language
3. `packages/core/src/project/resolution_registry.ts` - Remove duplicates, use cache
4. `packages/core/src/project/export_registry.ts` - Remove duplicate, use semantic_indexes
5. `packages/core/src/resolve_references/import_resolution/import_resolver.ts` - Export resolve_module_path

## Testing

Build verification shows:
- No errors in refactored files
- Pre-existing test issues unrelated to this change
- All signatures updated consistently

## Future Work

- [ ] Fix pre-existing test_helpers.ts compatibility issues
- [ ] Consider caching language detection in SemanticIndex (already done - language field exists)
- [ ] Profile performance improvement with large projects

## Related Tasks

- Task 11.144: Merge TypeContext into TypeRegistry
- Task 11.143: Remove exported_symbols from SemanticIndex
- Epic 11: Codebase Restructuring

## Notes

This refactoring aligns with the project's architecture principles:
- Single source of truth for data
- Clear ownership boundaries
- Performance through caching
- Minimize duplicate code
