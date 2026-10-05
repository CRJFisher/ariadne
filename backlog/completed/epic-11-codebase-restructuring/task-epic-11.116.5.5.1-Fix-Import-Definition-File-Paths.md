# Task epic-11.116.5.5.1: Fix Import Definition File Paths

**Status:** Completed
**Parent:** task-epic-11.116.5.5
**Priority:** High
**Created:** 2025-10-16

## Overview

ImportDefinitions currently use the importing file's path instead of the original definition's path. This causes resolution to point to the wrong file when following cross-file references.

**Discovered in:** TypeScript Project Integration Tests (see test: "should resolve to import when no local shadowing occurs")

## Problem Description

### Current Behavior

When a file imports a symbol:

```typescript
// utils.ts
export function otherFunction(): number {
  return 42;
}

// main_shadowing.ts
import { otherFunction } from './utils';
const other = otherFunction();
```

Resolution for `otherFunction` call returns a definition with:
- `location.file_path`: `"main_shadowing.ts"` ❌ (WRONG)
- Expected: `"utils.ts"` ✅

### Root Cause

ImportDefinitions are created with the importing file's location rather than linking to the original definition's location from the exported file.

**Likely location:** Import processing in `ImportGraph.update_file()` or `semantic_index.ts` where `ImportDefinition` objects are created.

## Expected Behavior

When resolving an imported symbol, the definition should point to:
- The **original file** where the symbol is defined (e.g., `utils.ts`)
- NOT the file doing the importing (e.g., `main_shadowing.ts`)

## Technical Details

### ImportDefinition Structure

```typescript
interface ImportDefinition {
  symbol_id: SymbolId;
  name: SymbolName;
  location: Location;  // ← This should be from the SOURCE file
  // ...
}
```

### Resolution Flow

1. File imports symbol → Creates ImportDefinition
2. ImportDefinition added to `semantic_index.imported_symbols`
3. ImportDefinition added to DefinitionRegistry
4. ResolutionRegistry resolves name → returns ImportDefinition's symbol_id
5. Caller looks up definition by symbol_id → gets ImportDefinition
6. **Bug**: ImportDefinition.location points to wrong file

## Solution Approach

### Option 1: Link to Original Definition (Recommended)

When creating ImportDefinition:
1. Resolve the import to find the exported symbol
2. Look up the original definition in ExportRegistry
3. Use the original definition's location for ImportDefinition

**Pros:**
- ImportDefinitions point to source of truth
- Follows principle of least surprise
- Easier debugging (definitions show where code lives)

**Cons:**
- Requires export resolution during import processing
- More complex import handling

### Option 2: Store Both Locations

Add `imported_from` location to ImportDefinition:

```typescript
interface ImportDefinition {
  location: Location;           // Where import statement is
  source_location: Location;    // Where original definition is
  // ...
}
```

**Pros:**
- Preserves both pieces of information
- Useful for debugging import chains

**Cons:**
- More memory overhead
- Need to decide which location to use for resolution

## Implementation Steps

1. **Locate ImportDefinition creation**:
   - Search for where `ImportDefinition` objects are constructed
   - Likely in `semantic_index.ts` or import processing

2. **Add export resolution**:
   - When processing an import, resolve it to the exported symbol
   - Look up the original definition's location

3. **Update ImportDefinition creation**:
   - Use the original definition's location instead of import statement location

4. **Update tests**:
   - Uncomment the assertions in `project.typescript.integration.test.ts`
   - Verify imported symbols resolve to source files

5. **Consider symbol_id generation**:
   - Ensure ImportDefinition symbol_id matches the original definition's symbol_id
   - This may require changes to how import symbol_ids are created

## Files to Investigate

- `packages/core/src/index_single_file/semantic_index.ts` - ImportDefinition creation
- `packages/core/src/project/import_graph.ts` - Import resolution
- `packages/core/src/resolve_references/registries/export_registry.ts` - Finding original exports

## Test Cases to Fix

In `project.typescript.integration.test.ts`:

1. **"should resolve to import when no local shadowing occurs"** (line 241)
   - Uncomment: `expect(resolved_def!.location.file_path).toContain("utils.ts");`

2. **"should update dependent files when imported file changes"** (line 301)
   - Uncomment: `expect(resolved_def_v1!.location.file_path).toContain("utils.ts");`

## Success Criteria

- [ ] ImportDefinitions point to original source file, not importing file
- [ ] All TypeScript integration tests pass with assertions uncommented
- [ ] Cross-file resolution follows import chain to source
- [ ] No regressions in existing resolution tests

## Estimated Effort

**2-3 hours**
- 1 hour: Investigate current import processing flow
- 1 hour: Implement location fix
- 30 min: Update and verify tests

## Related Issues

- Blocked by: None
- Blocks: Clean import resolution for all languages
- Related to: task-epic-11.116.5.5.4 (stale import cleanup)

## Implementation Notes

**Completed:** 2025-10-16

### Changes Made

1. **Modified [project.ts](../../../packages/core/src/project/project.ts)**:
   - After calling `imports.update_file()`, we now call `fix_import_definition_locations()` to correct ImportDefinition locations
   - The fix works by:
     1. Resolving each import to its source file using ImportGraph
     2. Finding the exported definition in the source file using ExportRegistry
     3. Replacing the ImportDefinition's location with the original definition's location
   - The definitions registry is updated twice:
     1. First with all definitions (including ImportDefinitions with importing file locations)
     2. Second with fixed ImportDefinitions (pointing to source file locations)
   - Removed the old `fix_import_definition_locations()` private method (was commented out)
   - Removed unused `ImportDefinition` import

2. **Updated [project.typescript.integration.test.ts](../../../packages/core/src/project/project.typescript.integration.test.ts)**:
   - Uncommented assertion in "should resolve to import when no local shadowing occurs" test (line 269)
   - Uncommented assertion in "should update dependent files when imported file changes" test (line 324)
   - Updated comments to reflect that ImportDefinitions now correctly point to original files

3. **Used existing [fix_import_locations.ts](../../../packages/core/src/project/fix_import_locations.ts)**:
   - This standalone function handles the logic for fixing import locations
   - It correctly handles cases where imports can't be resolved or exports don't exist
   - Returns fixed ImportDefinitions with corrected locations

### Test Results

All 13 tests in `project.typescript.integration.test.ts` pass, including:
- ✅ "should resolve to import when no local shadowing occurs"
- ✅ "should update dependent files when imported file changes"

### Architecture Notes

The fix maintains the correct order of operations:
1. Update definitions registry (with wrong import locations) - needed for exports
2. Update exports registry - uses definitions
3. Update imports graph - resolves import paths
4. Fix import locations - uses imports + exports + definitions
5. Update definitions registry again - with corrected import locations

This ensures that when resolving imported symbols, the definition points to the source file where the symbol is actually defined, not the file that imports it.
