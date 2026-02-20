# Task Epic 11.154.8.2: Fix JavaScript CommonJS Module Resolution

**Parent Task**: 11.154.8 - Final Integration
**Status**: Completed ✅
**Priority**: High
**Complexity**: Medium
**Actual Time**: 2 hours
**Test Impact**: Fixed 5 of 5 tests (100%)

---

## Summary

Fixed CommonJS require() detection, aliased ES6 imports, and default imports by adding query captures for require() patterns and fixing AST navigation functions to properly iterate children instead of using childForFieldName() for non-field nodes.

---

## Problem

5 JavaScript tests were failing:

1. ✅ "should resolve require() imports" - 0 imports found
2. ✅ "should resolve cross-file function calls in CommonJS" - resolution undefined
3. ✅ "should handle default exports" - import_kind was "named" instead of "default"
4. ✅ "should resolve aliased imports" - original_name undefined
5. ✅ "should resolve aliased class constructor calls" - original_name undefined

---

## Root Causes & Fixes

### 1. CommonJS require() Not Detected (Fixed 2 tests) ✅

**Problem**: `const { helper } = require('./utils')` was not creating import definitions.

**Root Cause**: No query captures for require() patterns - handlers existed (lines 587-680 in javascript_builder_config.ts) but were orphaned.

**Fix**: Added query patterns to javascript.scm after line 180:

```scheme
;; COMMONJS IMPORTS - require() patterns

; Destructuring require - const { a, b, c } = require('./module')
(variable_declarator
  name: (object_pattern
    (shorthand_property_identifier_pattern) @definition.import.require
  )
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)

; Array destructuring require - const [a, b, c] = require('./module')
(variable_declarator
  name: (array_pattern
    (identifier) @definition.import.require
  )
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)

; Simple require - const utils = require('./module')
(variable_declarator
  name: (identifier) @definition.import.require.simple
  value: (call_expression
    function: (identifier) @_require
    (#eq? @_require "require")
  )
)
```

**Key Points**:

- Uses predicate `(#eq? @_require "require")` to match only actual require() calls
- Captures individual identifiers from destructuring patterns
- Existing handlers already implemented correctly - just needed captures

**Result**: `const { helper, processData } = require('./utils')` now creates 2 import definitions ✅

### 2. Aliased Imports Have Undefined original_name (Fixed 2 tests) ✅

**Problem**: `import { helper as utilHelper }` created import with `original_name=undefined`

**Root Cause**: `extract_original_name()` in javascript_builder.ts used `childForFieldName()` for nodes that aren't fields in the JavaScript grammar.

**Tree-sitter structure**:

```text
import_statement
├─ import_clause         <- NOT a field, just a child
│  └─ named_imports      <- NOT a field, just a child
│     └─ import_specifier
│        ├─ name: "helper"        <- IS a field ✓
│        └─ alias: "utilHelper"   <- IS a field ✓
```

**Fix**: Changed javascript_builder.ts lines 700-731 to iterate children instead of using `childForFieldName()`:

```typescript
// Find import_clause as a child (not a field in JavaScript grammar)
let importClause: SyntaxNode | null = null;
for (const child of node.children || []) {
  if (child.type === "import_clause") {
    importClause = child;
    break;
  }
}

if (importClause) {
  // Find named_imports as a child (not a field)
  let namedImports: SyntaxNode | null = null;
  for (const child of importClause.children || []) {
    if (child.type === "named_imports") {
      namedImports = child;
      break;
    }
  }

  if (namedImports) {
    for (const child of namedImports.children || []) {
      if (child.type === "import_specifier") {
        const alias = child.childForFieldName("alias"); // alias IS a field
        if (alias?.text === local_name) {
          const name = child.childForFieldName("name"); // name IS a field
          return name?.text as SymbolName;
        }
      }
    }
  }
}
```

**Result**: `import { helper as utilHelper }` now correctly sets `original_name="helper"` ✅

### 3. Default Imports Detected as Named (Fixed 1 test) ✅

**Problem**: `import formatDate from './utils'` created import with `import_kind="named"` instead of `"default"`

**Root Cause**: `is_default_import()` in javascript_builder.ts used `childForFieldName()` for non-field nodes.

**Fix**: Changed javascript_builder.ts lines 739-758 to iterate children:

```typescript
export function is_default_import(node: SyntaxNode, name: SymbolName): boolean {
  // Find import_clause as a child (not a field in JavaScript grammar)
  let importClause: SyntaxNode | null = null;
  for (const child of node.children || []) {
    if (child.type === "import_clause") {
      importClause = child;
      break;
    }
  }

  if (importClause) {
    // Check if import_clause has a direct identifier child (the default import)
    for (const child of importClause.children || []) {
      if (child.type === "identifier" && child.text === name) {
        return true;
      }
    }
  }
  return false;
}
```

**Result**: `import formatDate from './utils'` now correctly sets `import_kind="default"` ✅

---

## Verification

### All 5 Tests Fixed ✅

```text
✅ should resolve require() imports
✅ should resolve cross-file function calls in CommonJS
✅ should handle default exports
✅ should resolve aliased imports
✅ should resolve aliased class constructor calls
```

### Patterns Verified

**CommonJS require()**:

- Destructuring: `const { a, b, c } = require('./mod')` → 3 imports ✅
- Array: `const [a, b] = require('./mod')` → 2 imports ✅
- Simple: `const utils = require('./mod')` → 1 import ✅

**Aliased imports**:

- `import { helper as utilHelper }` → original_name="helper" ✅
- `import { DataManager as Manager }` → original_name="DataManager" ✅

**Default imports**:

- `import formatDate from './utils'` → import_kind="default" ✅
- Default export resolution now works correctly ✅

### Test Impact

- Before: 11 total failures
- After: 6 total failures
- **Fixed**: 5 tests (all JavaScript import/CommonJS tests)
- Remaining 6 failures: 2 TypeScript + 2 Python + 2 Rust

---

## Files Modified

### Core Implementation

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm` - Added CommonJS require() query patterns (lines 182-218)
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts` - Fixed extract_original_name() to iterate children (lines 700-731)
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts` - Fixed is_default_import() to iterate children (lines 739-758)

### No Changes Needed

- `javascript_builder_config.ts` - require() handlers already existed and work correctly
- Resolution logic already handles all import types correctly

---

## Acceptance Criteria

- [x] require() imports detected and resolved
- [x] CommonJS cross-file function calls work
- [x] Aliased imports work with correct original_name
- [x] Aliased class constructor calls work
- [x] Default imports/exports work correctly
- [x] NO new fragment captures added (used complete node captures with predicates)
- [x] Validation still passes (0 errors, 0 warnings)

---

## Impact

All JavaScript import patterns now work correctly:

- ✅ CommonJS require() with destructuring creates individual import definitions
- ✅ CommonJS require() with simple assignment creates namespace import
- ✅ ES6 aliased imports properly track original_name for resolution
- ✅ ES6 default imports/exports resolve correctly with import_kind="default"
- ✅ Cross-module resolution works for both CommonJS and ES6
- ✅ Entry point detection works with all module types

This enables mixed ES6/CommonJS codebases to be analyzed correctly! 🎉

## Root Pattern

The root issue across all 3 fixes was the same: **using `childForFieldName()` for nodes that aren't fields in the JavaScript tree-sitter grammar.**

JavaScript grammar only defines fields for specific nodes (like `name`, `alias`, `source`), but many structural nodes (`import_clause`, `named_imports`, `export_clause`) are just children without field names and must be accessed by iterating `node.children`.
