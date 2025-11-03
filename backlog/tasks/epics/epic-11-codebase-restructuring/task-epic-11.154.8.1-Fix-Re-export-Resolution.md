# Task Epic 11.154.8.1: Fix Re-export Resolution

**Parent Task**: 11.154.8 - Final Integration
**Status**: Completed ✅
**Priority**: High
**Complexity**: Medium
**Actual Time**: 1 hour
**Test Impact**: Fixed 6 tests (6/6 = 100%)

---

## Summary

Fixed re-export resolution by correcting the export_clause field lookup in the JavaScript builder handler. The handler was using the wrong field name to access the export_clause node, causing it to exit early and never create import definitions for re-exports.

---

## Problem

All 6 re-export resolution tests were failing with `null` results:

1. "should resolve imports from re-exports in scope symbol table"
2. "should detect calls to re-exported functions"
3. "should not mark re-exported functions as entry points when they are called"
4. "should handle chained re-exports (A exports to B, B exports to C)"
5. "should resolve imports from re-exports in nested function scopes"
6. "should handle re-exports with nested directory structure and relative imports"

### Root Cause

**File**: `javascript_builder_config.ts` line 697

**Bug**: Handler was looking for export_clause in wrong field

```typescript
// WRONG - export_clause is NOT in a "declaration" field
const export_clause = export_stmt.childForFieldName("declaration");
```

**Tree-sitter AST for** `export { helper } from "./original"`:

```text
(export_statement)
  [0] (no field): export_clause  ← First named child, no field name
  [1] source: string              ← Only this has a field name
```

The handler would fail the type check and return early, never creating import definitions.

---

## Solution

Changed line 697 to use `namedChild(0)` instead of `childForFieldName("declaration")`:

```typescript
// CORRECT - export_clause is the first named child
const export_clause = export_stmt.namedChild(0);

if (!export_clause || export_clause.type !== "export_clause") {
  return;
}
```

---

## How It Works

### Re-export Flow (Now Working)

1. **Query Capture** (`typescript.scm:473-478`, `javascript.scm:190-195`):

   ```scheme
   (export_statement
     (export_clause
       (export_specifier)
     )
     source: (string)
   ) @import.reexport
   ```

2. **Builder Handler** (`javascript_builder_config.ts:687-748`):

   - Receives complete `export_statement` node
   - Extracts export_clause using `namedChild(0)` ✅ (was failing here)
   - Iterates through export_specifiers
   - Creates `ImportDefinition` for each with `is_reexport: true`

3. **ExportRegistry** (`export_registry.ts:324-391`):

   - Stores import_def in export metadata
   - `resolve_export_chain()` follows re-export chains recursively
   - Handles cycles and nested re-exports

4. **ResolutionRegistry** (`resolution_registry.ts:468`):

   - Calls `exports.resolve_export_chain()` for each import
   - Resolves through intermediate modules to find original definition

### Example Chain Resolution

```text
original.ts:  export function helper() { }
    ↓
index.ts:     export { helper } from "./original"
    ↓
consumer.ts:  import { helper } from "./index"
```

When resolving `helper` in consumer.ts:

1. Find import: `{ name: "helper", import_path: "./index" }`
2. Resolve "./index" → `index.ts`
3. Lookup export in index.ts → `{ is_reexport: true, import_def: {...} }`
4. Follow chain: resolve "./original" from index.ts → `original.ts`
5. Lookup export in original.ts → `{ symbol_id: "function:original.ts:2:helper" }`
6. Return original function's symbol_id ✅

---

## Verification

### All 6 Re-export Tests Pass ✅

```text
✓ should resolve imports from re-exports in scope symbol table
✓ should detect calls to re-exported functions
✓ should not mark re-exported functions as entry points when they are called
✓ should handle chained re-exports (A exports to B, B exports to C)
✓ should resolve imports from re-exports in nested function scopes
✓ should handle re-exports with nested directory structure and relative imports
```

### Re-export Patterns Verified ✅

Tested with various patterns:

- Simple: `export { helper } from "./original"` → 1 import ✅
- Multiple: `export { foo, bar, baz } from "./mod"` → 3 imports ✅
- Aliased: `export { oldName as newName } from "./mod"` → 1 import ✅

### Test Impact

- Before fix: 20 total test failures (including 6 re-export failures)
- After fix: 11 total test failures (re-export tests now passing)
- **Improvement**: Fixed 6 tests without breaking any others
- Remaining 11 failures are pre-existing issues (TypeScript params, Python decorators, etc.)

---

## Files Modified

**Core Fix**:

- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts` - Line 697: Changed from `childForFieldName("declaration")` to `namedChild(0)`

**No Changes Needed** (working correctly):

- Query files already had correct patterns
- ExportRegistry.resolve_export_chain() already implemented
- ResolutionRegistry already calls resolve_export_chain()

---

## Acceptance Criteria

- [x] All 6 re-export resolution tests pass
- [x] Chained re-exports resolve correctly (A → B → C)
- [x] Nested directory structure works
- [x] Re-exported functions not marked as entry points when called
- [x] NO new captures added to .scm files
- [x] Resolution logic works (builder now creates import definitions)

---

## Impact

Re-export resolution now works correctly for JavaScript and TypeScript:

- ✅ Import definitions created for re-export statements
- ✅ Export metadata stores is_reexport flag and import_def
- ✅ resolve_export_chain() follows chains to original definitions
- ✅ Consumers of re-exported symbols resolve to original source
- ✅ Entry point detection correctly excludes called re-exported functions

This enables barrel patterns (index.ts re-exporting from multiple files) to work correctly in the call graph detection! 🎉
