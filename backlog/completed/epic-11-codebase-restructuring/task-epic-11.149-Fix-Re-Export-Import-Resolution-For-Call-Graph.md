# Task epic-11.149: Fix Re-Export Import Resolution For Call Graph

**Status**: Open
**Priority**: High
**Complexity**: High
**Created**: 2025-10-23

## Problem

Functions imported via re-exports are incorrectly marked as entry points in the call graph, even when they are called from multiple locations. This causes massive inflation of the entry point count (142 instead of the expected ~10-20 actual API entry points).

### Symptoms

1. **False Entry Points**: `resolve_module_path` is marked as an entry point despite being called from `export_registry.ts` and `import_graph.ts`
2. **Missing Call References**: Resolved calls list shows 0 calls to `resolve_module_path` from files that import and call it
3. **Scope Resolution Failure**: When resolving the symbol name "resolve_module_path" in a scope that imports it via re-export, the resolution returns `null`

### Example Case

```typescript
// packages/core/src/resolve_references/import_resolution/import_resolver.ts
export function resolve_module_path(...) { ... }  // Original definition

// packages/core/src/resolve_references/import_resolution/index.ts
export { resolve_module_path } from "./import_resolver";  // Re-export

// packages/core/src/resolve_references/registries/export_registry.ts
import { resolve_module_path } from "../import_resolution";  // Import from re-export

// Line 366:
const resolved_file = resolve_module_path(...);  // ❌ Call not detected!
```

**Result**: `resolve_module_path` is marked as entry point with 0 callers.

## Root Cause Analysis

### What Works

✅ **Export Metadata**: Re-exports are correctly marked with `is_reexport: true` and contain proper `import_def`
✅ **Export Chain Resolution**: `exports.resolve_export_chain()` correctly resolves from index.ts → import_resolver.ts
✅ **Call Detection**: Calls are properly detected as `type: "call"`, `call_type: "function"`
✅ **Reference Detection**: SymbolReferences are created for the function calls at the correct locations

### What Fails

❌ **Scope Resolution**: When `resolution_registry.resolve(scope_id, "resolve_module_path")` is called, it returns `null`
❌ **Import Resolution**: The import of `resolve_module_path` from the re-export doesn't get added to the scope's symbol table
❌ **Call Graph**: Because calls can't be resolved, they're not included in the call graph, making the function appear as an entry point

### Debugging Evidence

From full project analysis (all 70 files loaded):

```
=== Raw References from export_registry.ts ===
Line 366: resolve_module_path
  type: call
  call_type: function
  scope_id: block:/Users/chuck/workspace/ariadne/packages/core/src/resolve_references/registries/export_registry.ts:355:5:387:5
  resolved to: null  ← THE BUG

=== Resolved Calls ===
From export_registry.ts: 0 calls resolved  ← No calls because resolution returns null
```

Export chain resolution test (isolated):
```
Resolving 'resolve_module_path' from index.ts:
  Result: function:.../import_resolver.ts:24:17:24:35:resolve_module_path
  Match: true  ← Works when called directly!
```

## Technical Details

### Resolution Flow

The expected flow in `resolution_registry.ts::resolve_scope_recursive()`:

1. **Import Processing** (lines 434-470):
   ```typescript
   for (const imp_def of import_defs) {
     // Get the imported symbol name
     const import_name = (imp_def.original_name || imp_def.name) as SymbolName;

     // Resolve export chain
     resolved = exports.resolve_export_chain(
       source_file,
       import_name,
       imp_def.import_kind,
       languages,
       root_folder
     );

     if (resolved) {
       scope_resolutions.set(imp_def.name, resolved);  ← Should add to scope!
     }
   }
   ```

2. **Call Resolution** (lines 228-268):
   ```typescript
   for (const ref of references) {
     if (ref.type !== "call") continue;

     if (ref.call_type === "function") {
       resolved = this.resolve(ref.scope_id, ref.name);  ← Returns null!
     }
   }
   ```

### Hypothesis

One of these is happening:

1. **Import Not Found**: `import_defs` for the scope doesn't include the `resolve_module_path` import
2. **Export Chain Fails**: `resolve_export_chain()` returns `null` in the real flow (but works in isolation)
3. **Wrong Source File**: The source file path being passed to `resolve_export_chain()` doesn't match index.ts
4. **Symbol ID Mismatch**: The resolved symbol ID is correct but doesn't match what's expected elsewhere
5. **Scope Inheritance**: The resolution is added to the wrong scope or not inherited properly

## Impact

**Current State**:
- Total entry points: 142
- Actual API entry points: ~10-20
- False positives: ~120-130 (85-92% of total!)

**Expected After Fix**:
- Entry points should drop to 10-20
- All re-exported functions should have their callers properly detected
- Call graph should be accurate

## Files Involved

### Core Issue
- `packages/core/src/resolve_references/resolution_registry.ts` - `resolve_scope_recursive()` and `resolve_calls()`
- `packages/core/src/resolve_references/registries/export_registry.ts` - `resolve_export_chain()`
- `packages/core/src/project/import_graph.ts` - Provides imports to resolution

### Re-Export Pattern (Example)
- `packages/core/src/resolve_references/import_resolution/import_resolver.ts` - Original definition
- `packages/core/src/resolve_references/import_resolution/index.ts` - Re-export
- `packages/core/src/resolve_references/registries/export_registry.ts` - Consumer
- `packages/core/src/project/import_graph.ts` - Consumer

## Next Steps

1. **Add Logging**: Insert debug logging in `resolve_scope_recursive()` to track:
   - Which imports are being processed
   - What `resolve_export_chain()` returns for each
   - What gets added to `scope_resolutions`

2. **Trace Import**: Follow the specific import of `resolve_module_path` through the resolution flow:
   - Verify it exists in `import_defs`
   - Check the source file path
   - Verify the export chain result
   - Confirm it's added to scope_resolutions

3. **Test Scope Lookup**: After resolution, verify that `resolve(module_scope, "resolve_module_path")` returns the correct symbol ID

4. **Fix and Test**: Once root cause is identified, fix the bug and verify:
   - Calls to `resolve_module_path` are resolved
   - Entry point count drops significantly
   - No regression in other call resolution

## Related Work

- task-epic-11.147: Initial debugging that found import resolution bug #1
- task-epic-11.148: Export detection bug (nested variables)
- This task: Re-export import resolution bug

All three bugs were discovered during the entry point debugging process initiated in `changes-notes.md`.

## Debug Scripts Created

- `/debug_reexport.ts` - Comprehensive re-export debugging
- `/check_resolve_calls.ts` - Verify call resolution in full analysis
- `/check_more_calls.ts` - Additional call checking

These scripts should be kept for regression testing after the fix.
