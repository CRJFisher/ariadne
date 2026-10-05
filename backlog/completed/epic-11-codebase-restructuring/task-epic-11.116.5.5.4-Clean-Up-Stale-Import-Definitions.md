# Task epic-11.116.5.5.4: Clean Up Stale Import Definitions

**Status:** Completed
**Parent:** task-epic-11.116.5.5
**Depends On:** task-epic-11.116.5.5.3
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Import definitions persist in the definition registry even after the source file is modified or deleted. This causes stale references to resolve successfully when they should fail.

**Discovered in:** TypeScript Project Integration Tests (see tests: "should update dependent files when imported file changes" and "should handle file removal and update dependents")

## Problem Description

### Current Behavior - Scenario 1: Source File Modified

```typescript
// utils.ts exports otherFunction
project.update_file(utils_file, "export function otherFunction() { return 42; }");
project.update_file(main_file, "import { otherFunction } from './utils'; otherFunction();");

// Resolution works ✓
const resolved = project.resolutions.resolve(scope, "otherFunction");
// Returns: symbol_id for otherFunction

// Modify utils.ts - rename the function
project.update_file(utils_file, "export function renamedFunction() { return 42; }");

// main.ts hasn't changed, still has import { otherFunction }
// Resolution STILL WORKS ❌ (should fail)
const resolved2 = project.resolutions.resolve(scope, "otherFunction");
// Returns: stale symbol_id for otherFunction (which no longer exists in utils.ts)
```

### Current Behavior - Scenario 2: Source File Removed

```typescript
project.update_file(utils_file, "export function otherFunction() { return 42; }");
project.update_file(main_file, "import { otherFunction } from './utils'; otherFunction();");

// Remove utils.ts entirely
project.remove_file(utils_file);

// main.ts still has the import statement
// Resolution STILL WORKS ❌ (should fail)
const resolved = project.resolutions.resolve(scope, "otherFunction");
// Returns: stale symbol_id (source file is deleted!)
```

### Root Cause

**ImportDefinitions are created in the importing file** and added to the definition registry:

```typescript
// In semantic_index.ts or similar:
const import_def: ImportDefinition = {
  symbol_id: variable_symbol("otherFunction", main_file, location),
  name: "otherFunction",
  location: { file_path: main_file, ... },  // Importing file
  kind: "variable",
  // ...
};

// Added to main.ts's semantic index
semantic_index.imported_symbols.set(symbol_id, import_def);

// Then added to DefinitionRegistry
this.definitions.update_file(main_file, [..., import_def]);
```

**When source file changes:**
1. `utils.ts` is updated → DefinitionRegistry updates for `utils.ts`
2. `otherFunction` is removed from `utils.ts` definitions
3. BUT: ImportDefinition is still in `main.ts` definitions!
4. Resolution finds the stale ImportDefinition in `main.ts`

**When source file is removed:**
1. `utils.ts` is removed → DefinitionRegistry removes `utils.ts` entries
2. BUT: ImportDefinition is still in `main.ts` definitions!
3. Resolution finds the orphaned ImportDefinition

## Expected Behavior

### When Source File Changes

If an imported symbol is renamed or removed in the source file:
1. Dependents should be identified (requires task-epic-11.116.5.5.3)
2. ImportDefinitions in dependents should be validated
3. Stale ImportDefinitions should be removed or marked invalid
4. Resolution should fail for symbols that no longer exist

### When Source File is Removed

If a file is deleted:
1. All ImportDefinitions that reference it should be removed
2. OR: ImportDefinitions should be marked as unresolvable
3. Resolution should fail for imports from deleted files

## Technical Details

### Current Resolution Flow

```typescript
// Phase 1: Name resolution
for (const file_id of affected_files) {
  // Resolve imports from ExportRegistry
  const import_resolutions = resolve_imports(
    file_id,
    imports,
    exports,
    root_folder
  );

  // Store in scope resolutions
  scope_resolutions.set(name, imported_symbol_id);
}

// BUT: If imported_symbol_id is stale, we don't detect it!
```

### Import Definition Lifecycle

**Created:**
- When file is parsed and import statements are found
- ImportDefinition added to importing file's semantic index
- Registered in DefinitionRegistry under importing file

**Updated:**
- Only when importing file is modified
- Not updated when source file changes

**Removed:**
- Only when importing file is removed
- Not removed when source file changes or is deleted

## Possible Solutions

### Option 1: Validate Imports During Resolution (Recommended)

During resolution, check if imported symbols still exist:

```typescript
resolve_imports(file_id, imports, exports, root_folder) {
  for (const import_def of imports) {
    const source_file = resolve_import_path(file_id, import_def.imported_from);

    // Check if source file exists
    if (!this.exports.has_file(source_file)) {
      // Source file removed - skip this import
      continue;
    }

    // Check if symbol is still exported
    const exported_symbols = this.exports.get_exports(source_file);
    if (!exported_symbols.has(import_def.name)) {
      // Symbol no longer exported - skip this import
      continue;
    }

    // Valid import - add to resolutions
    // ...
  }
}
```

**Pros:**
- Validates at resolution time
- Stale imports naturally fail to resolve
- No need to track or clean up ImportDefinitions

**Cons:**
- Extra lookups during resolution
- ImportDefinitions still exist (memory waste)

### Option 2: Clean Up Import Definitions on Source Change

When a source file changes, update all dependents' ImportDefinitions:

```typescript
update_file(file_id, content) {
  // ... update semantic index ...

  // Get dependents (who imports from this file)
  const dependents = this.imports.get_dependents(file_id);

  for (const dependent of dependents) {
    // Re-validate dependent's imports
    this.validate_and_clean_imports(dependent, file_id);
  }
}

validate_and_clean_imports(importing_file, source_file) {
  const semantic_index = this.get_semantic_index(importing_file);
  const exported_symbols = this.exports.get_exports(source_file);

  // Filter out stale imports
  const valid_imports = Array.from(semantic_index.imported_symbols.values())
    .filter(imp => {
      if (imp.imported_from !== source_file) return true;
      return exported_symbols.has(imp.name);
    });

  // Update semantic index and definition registry
  // ...
}
```

**Pros:**
- Proactively cleans up stale data
- Smaller memory footprint
- Explicit lifecycle management

**Cons:**
- Complex - requires tracking dependents
- More work during file updates
- Depends on task-epic-11.116.5.5.3 (path matching)

### Option 3: Lazy Cleanup

Mark ImportDefinitions as stale but don't remove them:

```typescript
interface ImportDefinition {
  // ...
  is_valid?: boolean;  // Set to false when source changes
}

// During resolution:
if (import_def.is_valid === false) {
  continue;  // Skip stale import
}
```

**Pros:**
- Minimal changes
- Fast updates

**Cons:**
- Memory waste
- Still need validation logic
- Stale data accumulates

## Recommended Approach

**Combination of Option 1 and Option 2:**

1. **Immediate fix (Option 1)**: Add validation during resolution
   - Prevents stale imports from resolving
   - Low risk, high value

2. **Long-term cleanup (Option 2)**: Clean up ImportDefinitions
   - Implement after task-epic-11.116.5.5.3 (dependency tracking)
   - Keeps memory usage low
   - Proper lifecycle management

## Implementation Steps

### Phase 1: Validation During Resolution (Quick Win)

1. **Update import resolution in ResolutionRegistry**:
   ```typescript
   resolve_scope_recursive(...) {
     // When processing imports:
     for (const import_def of imports) {
       // Validate import is still valid
       if (!this.is_import_valid(import_def, exports)) {
         continue;  // Skip stale import
       }
       // Add to scope resolutions
     }
   }

   is_import_valid(import_def: ImportDefinition, exports: ExportRegistry): boolean {
     const source_file = import_def.imported_from;  // Need to track this!
     const exported = exports.get_exports(source_file);
     return exported.has(import_def.name);
   }
   ```

2. **Update ImportDefinition to track source**:
   ```typescript
   interface ImportDefinition {
     // ...
     imported_from: FilePath;  // Source file path (may need to add this)
   }
   ```

3. **Update tests**:
   - Uncomment assertions in integration tests
   - Verify stale imports don't resolve

### Phase 2: Proactive Cleanup (Future Work)

After task-epic-11.116.5.5.3 is complete:

1. **Implement validate_and_clean_imports()**
2. **Call it when source files change**
3. **Remove stale ImportDefinitions from registry**

## Files to Modify

### Phase 1
- `packages/core/src/resolve_references/resolution_registry.ts` - Add validation
- `packages/types/src/symbol_definitions.ts` - Add `imported_from` to ImportDefinition?

### Phase 2 (Future)
- `packages/core/src/project/project.ts` - Clean up dependents on file change
- `packages/core/src/index_single_file/semantic_index.ts` - Update ImportDefinition structure

## Test Cases to Fix

In `project.typescript.integration.test.ts`:

**"should update dependent files when imported file changes"** (line 301)
```typescript
// TODO: Import definitions should be removed when source file changes
// Uncomment:
expect(resolved_v2).toBeNull();
```

**"should handle file removal and update dependents"** (line 357)
```typescript
// TODO: Same issue as above - import definitions should be cleaned up
// Uncomment:
expect(resolved).toBeNull();
```

## Implementation Notes

### Completed: Phase 1 Fix

**Root Cause Identified:**
ImportDefinitions were being added to the scope index in DefinitionRegistry (line 85-91), causing them to override properly resolved imports during symbol resolution. When local definitions were processed (Step 2 of resolve_scope_recursive), ImportDefinitions would shadow the correctly resolved symbols from Step 1.

**Solution Applied:**
Modified `DefinitionRegistry.update_file()` to exclude ImportDefinitions from the scope index:

- File: [`packages/core/src/resolve_references/registries/definition_registry.ts`](packages/core/src/resolve_references/registries/definition_registry.ts:89)
- Added conditional check: `if (def.kind !== "import")` before adding to scope index
- ImportDefinitions are now only resolved via import resolution logic in resolve_scope_recursive Step 1

**How It Works:**

1. When source file changes, ExportRegistry is updated (removes old exports, adds new ones)
2. Dependents are re-resolved via ResolutionRegistry.resolve_files()
3. During import resolution (Step 1), exports.resolve_export_chain() checks if export still exists
4. If export removed, resolve_export_chain returns null, import is not added to scope_resolutions
5. Local definitions (Step 2) no longer override with stale ImportDefinitions

**Tests Updated:**

- Uncommented assertions in [`packages/core/src/project/project.typescript.integration.test.ts`](packages/core/src/project/project.typescript.integration.test.ts:348)
  - Line 348: "should update dependent files when imported file changes"
  - Line 384: "should handle file removal and update dependents"

## Success Criteria

### Phase 1

- [x] Stale imports don't resolve after source file changes
- [x] Orphaned imports don't resolve after source file removal
- [x] Integration tests pass with assertions uncommented

### Phase 2 (Future Work)

- [ ] ImportDefinitions are removed when source changes
- [ ] Memory usage doesn't grow with stale imports
- [ ] Dependent files are properly cleaned up

## Estimated Effort

**Phase 1: 2-3 hours**
- 1 hour: Add validation logic to resolution
- 1 hour: Update ImportDefinition structure if needed
- 30 min: Update and verify tests

**Phase 2: 3-4 hours** (future work)
- 2 hours: Implement cleanup logic
- 1 hour: Integrate with file update flow
- 1 hour: Test and verify

## Related Issues

- Depends on: task-epic-11.116.5.5.3 (dependency tracking for Phase 2)
- Related to: task-epic-11.116.5.5.1 (import file paths)
- Blocks: Accurate incremental resolution

## References

The problem is similar to how TypeScript's language service handles file changes:
- Invalidates cached data when files change
- Re-validates imports against current exports
- Removes orphaned references
