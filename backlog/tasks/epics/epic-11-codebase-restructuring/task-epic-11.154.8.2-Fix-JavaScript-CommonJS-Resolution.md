# Task Epic 11.154.8.2: Fix JavaScript CommonJS Module Resolution

**Parent Task**: 11.154.8 - Final Integration
**Status**: Completed (Partial) ✅
**Priority**: High
**Complexity**: Medium
**Actual Time**: 1.5 hours
**Test Impact**: Fixed 4 of 5 tests (80%)

---

## Summary

Fixed CommonJS require() detection and aliased ES6 imports by adding query captures for require() patterns and fixing the `extract_original_name()` function to properly navigate the tree-sitter AST.

---

## Problem

5 JavaScript tests were failing:

1. ✅ "should resolve require() imports" - 0 imports found
2. ✅ "should resolve cross-file function calls in CommonJS" - resolution undefined
3. ❌ "should handle default exports" - resolution undefined (not fixed - different issue)
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

---

## Verification

### Tests Fixed (4 of 5) ✅

```text
✅ should resolve require() imports
✅ should resolve cross-file function calls in CommonJS
✅ should resolve aliased imports
✅ should resolve aliased class constructor calls
❌ should handle default exports (separate issue - likely in task 11.154.8.4)
```

### Patterns Verified

**CommonJS require()**:

- Destructuring: `const { a, b, c } = require('./mod')` → 3 imports ✅
- Array: `const [a, b] = require('./mod')` → 2 imports ✅
- Simple: `const utils = require('./mod')` → 1 import ✅

**Aliased imports**:

- `import { helper as utilHelper }` → original_name="helper" ✅
- `import { DataManager as Manager }` → original_name="DataManager" ✅

### Test Impact

- Before: 11 total failures
- After: 7 total failures
- **Fixed**: 4 tests
- Remaining 7 failures: 1 default export + 2 TypeScript + 2 Python + 2 Rust

---

## Files Modified

### Core Implementation

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm` - Added CommonJS require() query patterns (lines 182-218)
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts` - Fixed extract_original_name() to iterate children (lines 700-731)

### No Changes Needed

- `javascript_builder_config.ts` - require() handlers already existed and work correctly
- Resolution logic already handles CommonJS imports correctly

---

## Remaining Issue

**Default exports** (1 test) - Not addressed in this task

The failing test "should handle default exports" involves resolving default import/export pairs. This appears to be a separate issue from CommonJS and aliased imports, likely belonging to task 11.154.8.4 (edge cases).

---

## Acceptance Criteria

- [x] require() imports detected and resolved
- [x] CommonJS cross-file function calls work
- [x] Aliased imports work with correct original_name
- [x] Aliased class constructor calls work
- [x] NO new fragment captures added (used complete node captures with predicates)
- [x] Validation still passes (0 errors, 0 warnings)
- [ ] Default exports work (not fixed - separate issue)

---

## Impact

CommonJS and ES6 aliased imports now work correctly:

- ✅ require() with destructuring creates individual import definitions
- ✅ require() with simple assignment creates namespace import
- ✅ Aliased imports properly track original_name for resolution
- ✅ Cross-module CommonJS resolution works
- ✅ Entry point detection works with CommonJS modules

This enables mixed ES6/CommonJS codebases to be analyzed correctly! 🎉
