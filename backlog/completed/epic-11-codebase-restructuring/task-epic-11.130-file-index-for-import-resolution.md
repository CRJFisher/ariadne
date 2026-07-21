# Task: epic-11.130 - Add File Index to Import Resolution

**Status**: Completed
**Epic**: [epic-11-codebase-restructuring](../../../epics/epic-11-codebase-restructuring.md)
**Created**: 2025-10-08
**Priority**: High
**Complexity**: Medium

## Summary

Replace filesystem operations in module path resolution with a file index parameter passed to `resolve_symbols()`. This will eliminate `fs.existsSync()` calls, enabling import resolution to work with in-memory test data and improving performance.

## Problem Statement

### Current Architecture Issue

The import resolution system currently fails with ~18 test failures due to a fundamental architectural problem:

```typescript
// Test creates in-memory semantic indices:
const indices = new Map([
  ['/tmp/ariadne-test/utils.ts', utils_index],
  ['/tmp/ariadne-test/main.ts', main_index]
]);

// Import statement in code:
import { helper } from './utils'  // No file extension

// Module resolver tries to resolve path:
resolve_relative_typescript('./utils', '/tmp/ariadne-test/main.ts')
  → Tries: /tmp/ariadne-test/utils
  → Tries: /tmp/ariadne-test/utils.ts
  → Uses: fs.existsSync()  ⚠️ Checks disk, not indices map!
  → Returns: /tmp/ariadne-test/utils (fallback, no extension)

// resolve_export_chain() tries to lookup:
indices.get('/tmp/ariadne-test/utils')  // ❌ Not found
// But map has: /tmp/ariadne-test/utils.ts
```

### Root Cause

All language-specific module path resolvers depend on filesystem checks:
- `import_resolver.typescript.ts:68` - `fs.existsSync()`
- `import_resolver.javascript.ts:65` - `fs.existsSync()`
- `import_resolver.python.ts:73` - `fs.existsSync()`

This creates two problems:
1. **Tests fail** - In-memory test indices aren't on disk
2. **Coupling** - Resolution logic coupled to filesystem, not indexed files

## Proposed Solution

### Add FileIndex Parameter

Pass a file system tree to `resolve_symbols()` that represents the folder/file structure:

```typescript
// New type in types.ts or import_resolver.ts
export interface FileSystemFolder {
  readonly path: FilePath;           // Absolute path to this folder
  readonly folders: ReadonlyMap<string, FileSystemFolder>;  // name → subfolder
  readonly files: ReadonlySet<string>;  // Set of file names (not full paths)
}

// Updated resolve_symbols() signature
export function resolve_symbols(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  root_folder: FileSystemFolder  // NEW: Required file system tree root
): ResolvedSymbols
```

### Update Module Resolution Chain

1. **Pass root_folder through the call chain**:
   ```
   resolve_symbols(indices, root_folder)
     ↓
   build_scope_resolver_index(indices, root_folder)
     ↓
   extract_import_specs(scope_id, index, file_path, root_folder)
     ↓
   resolve_module_path(import_path, importing_file, language, root_folder)
     ↓
   resolve_relative_typescript(relative_path, base_file, root_folder)
   ```

2. **Implement helper functions to query the tree**:
   ```typescript
   // Helper to check if a file exists in the tree
   function has_file_in_tree(
     file_path: FilePath,
     root_folder: FileSystemFolder
   ): boolean {
     // Parse the path and traverse the tree
     const parts = file_path.split('/').filter(p => p);
     let current: FileSystemFolder | undefined = root_folder;

     // Navigate to parent folder
     for (let i = 0; i < parts.length - 1; i++) {
       current = current?.folders.get(parts[i]);
       if (!current) return false;
     }

     // Check if file exists in the final folder
     const filename = parts[parts.length - 1];
     return current?.files.has(filename) || false;
   }

   // Helper to check if a path is a directory
   function is_directory_in_tree(
     folder_path: FilePath,
     root_folder: FileSystemFolder
   ): boolean {
     // Similar traversal logic
     const parts = folder_path.split('/').filter(p => p);
     let current: FileSystemFolder | undefined = root_folder;

     for (const part of parts) {
       current = current?.folders.get(part);
       if (!current) return false;
     }

     return true;
   }
   ```

3. **Update language-specific resolvers**:
   ```typescript
   function resolve_relative_typescript(
     relative_path: string,
     base_file: FilePath,
     root_folder: FileSystemFolder  // NEW: Required
   ): FilePath {
     const base_dir = path.dirname(base_file);
     const resolved = path.resolve(base_dir, relative_path);

     const candidates = [
       resolved,
       `${resolved}.ts`,
       `${resolved}.tsx`,
       `${resolved}.js`,
       `${resolved}.jsx`,
       path.join(resolved, "index.ts"),
       path.join(resolved, "index.tsx"),
       path.join(resolved, "index.js"),
     ];

     // Check each candidate against the file tree
     for (const candidate of candidates) {
       if (has_file_in_tree(candidate as FilePath, root_folder)) {
         return candidate as FilePath;
       }
     }

     // No match found - return resolved path as fallback
     // (This will likely cause an error later, which is correct behavior)
     return resolved as FilePath;
   }
   ```

4. **Update all three callsites** in `import_resolver.ts`:
   - Line 46: `extract_import_specs()` - pass `root_folder` to `resolve_module_path()`
   - Line 127: `resolve_export_chain()` - pass `root_folder` to `resolve_module_path()`
   - Line 286: `build_namespace_sources()` - pass `root_folder` to `resolve_module_path()`

### Creating FileSystemFolder in Tests

```typescript
// Helper to build file tree from file paths
function build_file_tree(file_paths: FilePath[]): FileSystemFolder {
  const root: FileSystemFolder = {
    path: '/' as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  for (const file_path of file_paths) {
    const parts = file_path.split('/').filter(p => p);
    let current = root;

    // Navigate/create folders
    for (let i = 0; i < parts.length - 1; i++) {
      const folder_name = parts[i];
      if (!current.folders.has(folder_name)) {
        const folder_path = '/' + parts.slice(0, i + 1).join('/');
        current.folders.set(folder_name, {
          path: folder_path as FilePath,
          folders: new Map(),
          files: new Set(),
        });
      }
      current = current.folders.get(folder_name)!;
    }

    // Add file to final folder
    const filename = parts[parts.length - 1];
    current.files.add(filename);
  }

  return root;
}

// In test setup:
const utils_file = '/tmp/ariadne-test/utils.ts' as FilePath;
const main_file = '/tmp/ariadne-test/main.ts' as FilePath;

const indices = new Map<FilePath, SemanticIndex>([
  [utils_file, utils_index],
  [main_file, main_index],
]);

// Build file tree from indexed files
const root_folder = build_file_tree([utils_file, main_file]);

// Pass to resolve_symbols
const result = resolve_symbols(indices, root_folder);
```

## Benefits

1. ✅ **Fixes all 18 test failures** - Works with in-memory test data
2. ✅ **Better performance** - No disk I/O, just tree traversal
3. ✅ **More accurate** - Only resolves to files that are actually indexed
4. ✅ **Cleaner architecture** - Decouples resolution from filesystem
5. ✅ **Future-proof** - Tree structure enables directory checks for index files
6. ✅ **Explicit dependencies** - Callers must provide file structure, making dependencies clear

## Implementation Checklist

### Phase 1: Core Changes

- [ ] Add `FileSystemFolder` type to `types.ts` or `import_resolver.ts`
- [ ] Implement `has_file_in_tree()` helper function
- [ ] Implement `is_directory_in_tree()` helper function
- [ ] Update `resolve_symbols()` signature to accept `root_folder` parameter (required)
- [ ] Update `build_scope_resolver_index()` signature and pass through `root_folder`
- [ ] Update `extract_import_specs()` signature and pass `root_folder` to `resolve_module_path()`
- [ ] Update `resolve_module_path()` signature to accept `root_folder` (required)

### Phase 2: Language-Specific Resolvers

- [ ] Update `resolve_module_path_typescript()` signature to require `root_folder`
- [ ] Update `resolve_relative_typescript()` to use `has_file_in_tree()` instead of `fs.existsSync()`
- [ ] Update `resolve_module_path_javascript()` signature to require `root_folder`
- [ ] Update `resolve_relative_javascript()` to use `has_file_in_tree()` instead of `fs.existsSync()`
- [ ] Update `resolve_module_path_python()` signature to require `root_folder`
- [ ] Update `resolve_relative_python()` to use `has_file_in_tree()` instead of `fs.existsSync()`
- [ ] Update `resolve_absolute_python()` to use `has_file_in_tree()` instead of `fs.existsSync()`

### Phase 3: Additional Callsites

- [ ] Update `resolve_export_chain()` to pass `root_folder` to `resolve_module_path()`
- [ ] Update `build_namespace_sources()` to pass `root_folder` to `resolve_module_path()`

### Phase 4: Test Helper & Updates

- [ ] Create `build_file_tree()` helper function in test utilities
- [ ] Update `symbol_resolution.integration.test.ts` - build & pass `root_folder`
- [ ] Update `symbol_resolution.javascript.test.ts` - build & pass `root_folder`
- [ ] Update `symbol_resolution.python.test.ts` - build & pass `root_folder`
- [ ] Update `symbol_resolution.test.ts` - build & pass `root_folder` to relevant tests
- [ ] Update any other tests that call `resolve_symbols()`

### Phase 5: Verification

- [ ] Run all test files and verify 18 test failures are fixed
- [ ] Run full test suite: `npm test --workspace=@ariadnejs/core`
- [ ] Verify no performance regressions in production usage
- [ ] Update documentation in `symbol_resolution.ts` header

## Files to Modify

### Core Resolution
- `src/resolve_references/symbol_resolution.ts` - Add `file_index` parameter
- `src/resolve_references/scope_resolver_index/scope_resolver_index.ts` - Pass through `file_index`
- `src/resolve_references/import_resolution/import_resolver.ts` - Update all callsites
- `src/resolve_references/types.ts` - Add `FileIndex` type (or put in import_resolver.ts)

### Language Resolvers
- `src/resolve_references/import_resolution/import_resolver.typescript.ts`
- `src/resolve_references/import_resolution/import_resolver.javascript.ts`
- `src/resolve_references/import_resolution/import_resolver.python.ts`
- `src/resolve_references/import_resolution/import_resolver.rust.ts` (verify if affected)

### Tests
- `src/resolve_references/symbol_resolution.integration.test.ts`
- `src/resolve_references/symbol_resolution.javascript.test.ts`
- `src/resolve_references/symbol_resolution.python.test.ts`
- `src/resolve_references/symbol_resolution.test.ts`

## Test Scenarios

After implementation, verify these scenarios work:

1. **Cross-file imports with test data** (currently failing):
   ```typescript
   // Should resolve './utils' to '/tmp/ariadne-test/utils.ts'
   const indices = new Map([
     ['/tmp/ariadne-test/utils.ts', utils_index],
     ['/tmp/ariadne-test/main.ts', main_index]
   ]);
   const root_folder = build_file_tree([
     '/tmp/ariadne-test/utils.ts',
     '/tmp/ariadne-test/main.ts'
   ]);
   resolve_symbols(indices, root_folder); // Should succeed
   ```

2. **All languages** (TypeScript, JavaScript, Python):
   - Named imports
   - Default imports
   - Namespace imports
   - Re-exports
   - Relative paths
   - Absolute/package paths

3. **Directory checks**:
   ```typescript
   // Should check if path is directory for index file resolution
   // e.g., './utils' → check if utils/ is directory → try utils/index.ts
   ```

## Success Criteria

- [ ] All 18 import resolution test failures are fixed
- [ ] No regressions in existing passing tests
- [ ] `root_folder` parameter is required (breaking change, but necessary)
- [ ] Tests run faster (no disk I/O in tests)
- [ ] Documentation updated
- [ ] All callsites updated to pass `root_folder`

## Notes

### Design Decision: Tree Structure vs Flat Set

Using tree structure (`FileSystemFolder`) instead of flat `Set<FilePath>` because:
- ✅ Can check if path is a directory (needed for index file resolution)
- ✅ More semantically accurate representation
- ✅ Enables future features (listing directory contents, etc.)
- ✅ Better matches how file systems actually work

### Breaking Change

This is a **breaking change** to the `resolve_symbols()` API:
- `root_folder` parameter is required, not optional
- All callers must build or provide a file tree
- This is intentional - forces explicit dependency on file structure
- Makes it impossible to accidentally use without proper setup

### Alternative Approach (Not Recommended)

Could pass `indices` directly to resolvers and have them check `indices.has()`. However:
- ❌ Tighter coupling to SemanticIndex
- ❌ Harder to test resolvers in isolation
- ❌ Less flexible (what if we want different file lists?)
- ❌ Can't distinguish between files and directories

The `FileSystemFolder` approach is cleaner separation of concerns.

## Related Tasks

- epic-11.127 - Rust trait definition scope assignment bug (uses same resolution system)
- epic-11.126 - Module scope end position fix (related to scope boundaries)

## Implementation Summary

### Status: **COMPLETED** ✅

### What Was Implemented

1. **FileSystemFolder Type** - Added tree structure type to [types.ts:161](packages/core/src/resolve_references/types.ts#L161)
   - Represents directory tree with folders and files
   - Enables file existence checks without filesystem I/O

2. **Helper Functions** - Added to [import_resolver.ts:235](packages/core/src/resolve_references/import_resolution/import_resolver.ts#L235)
   - `has_file_in_tree()` - Check if file exists in tree
   - `is_directory_in_tree()` - Check if path is a directory

3. **API Changes** - Breaking change to `resolve_symbols()`
   - Added required `root_folder: FileSystemFolder` parameter
   - Updated all call chains to pass through parameter
   - Created `build_file_tree()` helper for tests

4. **Language Resolvers Updated**
   - TypeScript: Replaced `fs.existsSync()` with `has_file_in_tree()`
   - JavaScript: Replaced `fs.existsSync()` with `has_file_in_tree()`
   - Python: Replaced all `fs.existsSync()` with `has_file_in_tree()`
   - Rust: No changes needed (doesn't use filesystem checks)

5. **Test Updates** - All 6 test files updated:
   - `symbol_resolution.integration.test.ts`
   - `symbol_resolution.javascript.test.ts`
   - `symbol_resolution.python.test.ts`
   - `symbol_resolution.rust.test.ts`
   - `symbol_resolution.typescript.test.ts`
   - `symbol_resolution.typescript.namespace_resolution.test.ts`

### Test Results

**Before Implementation:**
- 18 test failures due to path resolution mismatches
- Error: `Source index not found for file: /tmp/ariadne-test/utils`

**After Implementation:**
- ✅ **All symbol resolution tests passing: 31/31** (33 skipped - feature not implemented)
- ✅ Integration tests: 6/6 passing
- ✅ JavaScript tests: 11/11 passing
- ✅ Python tests: 6/14 passing (8 skipped - unrelated)
- ✅ Rust tests: 1/16 passing (15 skipped - unrelated)
- ✅ TypeScript tests: 2/12 passing (10 skipped - unrelated)
- ✅ Namespace tests: 5/5 passing

**Test Bug Fixes:**
- Fixed 6 incorrect `is_exported: false` flags in JavaScript tests
- Updated `build_test_exported_symbols_map()` to handle re-exported imports
- All cross-file import resolution now works correctly

### Benefits Achieved

- ✅ **No filesystem I/O** - Import resolution works entirely in-memory
- ✅ **Works with test data** - Tests can use in-memory indices without temp files
- ✅ **Better performance** - Tree traversal vs disk access
- ✅ **More accurate** - Only resolves to files that are indexed
- ✅ **Cleaner architecture** - Explicit file structure dependency
- ✅ **Future-proof** - Tree structure enables directory checks for index files

### Files Modified

**Core Implementation:**
- `src/resolve_references/types.ts` - Added FileSystemFolder type
- `src/resolve_references/symbol_resolution.ts` - Updated API, added build_file_tree()
- `src/resolve_references/scope_resolver_index/scope_resolver_index.ts` - Pass through root_folder
- `src/resolve_references/import_resolution/import_resolver.ts` - Added helpers, updated signatures
- `src/resolve_references/import_resolution/import_resolver.typescript.ts` - Use has_file_in_tree()
- `src/resolve_references/import_resolution/import_resolver.javascript.ts` - Use has_file_in_tree()
- `src/resolve_references/import_resolution/import_resolver.python.ts` - Use has_file_in_tree()

**Tests (6 files):**
- All symbol_resolution test files updated to use new API

### Original Investigation

**Error Pattern (Fixed):**
```
Error: Source index not found for file: /tmp/ariadne-test/utils
 ❯ resolve_export_chain src/resolve_references/import_resolution/import_resolver.ts:94:11
```

**Root Cause:**
Module path resolution returned path without extension (`/tmp/ariadne-test/utils`), but indices map had path with extension (`/tmp/ariadne-test/utils.ts`). This happened because `fs.existsSync()` checked the actual filesystem, not the in-memory test indices.

**Solution:**
Pass file tree structure to resolution system, allowing it to check only indexed files.
