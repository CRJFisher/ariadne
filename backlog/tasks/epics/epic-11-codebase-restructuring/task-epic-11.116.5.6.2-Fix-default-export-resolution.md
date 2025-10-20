# Task epic-11.116.5.6.2: Fix default export resolution in JavaScript

**Status:** To Do
**Parent:** task-epic-11.116.5.6
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Default exports in JavaScript ES6 modules are not resolving correctly. The import is captured, but the resolved definition cannot be found in the definitions registry.

## Problem

When running JavaScript integration tests, the default export test fails with:

```
FAIL: should handle default exports
  expected undefined to be defined
  (resolved_def is undefined)
```

The test shows that:
1. The default import `formatDate` is correctly captured in `imported_symbols`
2. The function call to `formatDate()` is correctly captured as a reference
3. The resolution finds a `symbol_id` for the call
4. BUT: `project.definitions.get(resolved!)` returns `undefined`

This suggests the default exported function definition is not being registered in the definitions registry, or the symbol_id returned by resolution doesn't match.

## Test Case

**utils_es6.js:**
```javascript
// Named exports
export function helper() { return "from utils es6"; }

// Default export
export default function formatDate(date) {
  return date.toISOString().split('T')[0];
}
```

**main_es6.js:**
```javascript
import { helper } from './utils_es6.js';
import formatDate from './utils_es6.js';  // Default import

const today = formatDate(new Date());  // Call should resolve
```

## Root Cause Investigation Needed

The query file has patterns for default exports:

```scheme
; Default exports
(export_statement
  (identifier) @export.variable
)

(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function
  )
)
```

However, `export default function formatDate(date)` might not be matching these patterns correctly.

Possible issues:
1. The pattern doesn't match `export default function` syntax
2. The function definition is captured but not registered correctly
3. The ImportDefinition for default imports doesn't resolve to the correct symbol_id
4. The symbol_id mapping is incorrect

## Acceptance Criteria

- [ ] Investigate why default exported functions are not in definitions registry
- [ ] Fix query patterns if needed for `export default function name()`
- [ ] Fix import resolution for default imports
- [ ] Verify default export test passes
- [ ] Verify default imports resolve to correct symbol_id
- [ ] Test both named and anonymous default exports

## Investigation Steps

1. **Check if the function definition is captured:**
   - Add logging to see if `formatDate` appears in `functions` map
   - Verify the symbol_id is generated

2. **Check if the export is registered:**
   - Verify the export processor captures the default export
   - Check if it creates the right definition type

3. **Check if the import creates the right mapping:**
   - Verify default import creates ImportDefinition
   - Check if the import_source path is correct
   - Verify the symbol_id mapping

4. **Check resolution logic:**
   - Trace through `resolve_references` for default imports
   - Verify the resolution finds the right symbol

## Test Cases to Add

- [ ] Anonymous default export: `export default function() {}`
- [ ] Default export of existing function: `function foo() {}; export default foo;`
- [ ] Default export of arrow function: `export default () => {}`
- [ ] Default export of class: `export default class Foo {}`

## Estimated Effort

**2-3 hours**
- 1 hour: Investigation and diagnosis
- 1 hour: Fix implementation
- 1 hour: Testing and verification

## Related Files

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm` - Query patterns
- `packages/core/src/index_single_file/export_processor.ts` - Export handling
- `packages/core/src/index_single_file/import_processor.ts` - Import handling
- `packages/core/src/resolve_references/index.ts` - Resolution logic
- `packages/core/src/project/project.javascript.integration.test.ts` - Test file

## Implementation Notes

### Root Cause

The JavaScript query file (`javascript.scm`) was capturing import statements with the wrong capture names, causing default imports to be processed as named imports.

**The Bug:**
- Default imports were captured as `@definition.import` (line 199-201)
- This called a generic handler that didn't distinguish import types
- Default imports were incorrectly assigned `import_kind: "named"`
- Resolution failed because it looked for a named export instead of the default export

### Solution

Fixed the query patterns and handler registrations to properly distinguish between import types:

**1. Updated javascript.scm** (lines 188-206):
```scheme
; Named imports
(import_specifier
  name: (identifier) @definition.import.named
)

; Default imports  
(import_clause
  (identifier) @definition.import.default
)

; Namespace imports
(namespace_import
  (identifier) @definition.import.namespace
)
```

**2. Updated javascript_builder_config.ts** (lines 466, 494, 518):
- Renamed `import.named` → `definition.import.named`
- Renamed `import.default` → `definition.import.default`
- Renamed `import.namespace` → `definition.import.namespace`

These handlers already existed with the correct logic (setting `import_kind` appropriately), they just needed to match the new capture names.

### Why This Works

1. Query patterns now capture each import type with a unique name
2. Each capture routes to a specific handler that sets the correct `import_kind`
3. Resolution uses `import_kind` to determine whether to call:
   - `get_default_export()` for default imports
   - `get_export()` for named imports
4. Default exports are correctly resolved to their function definitions

### Test Results

**Before:** 9 failed / 10 passed
**After:** 1 failed / 18 passed ✅

The "should handle default exports" test now passes. The remaining failure is the CommonJS cross-file test, which requires module.exports tracking (separate task from epic-11.116.5.6.1).

### Files Modified

1. `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
2. `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
