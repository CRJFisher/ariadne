# Task epic-11.112.6: Update JavaScript for Body-Based Scopes

**Parent:** task-epic-11.112
**Status:** Done
**Estimated Time:** 1 hour
**Actual Time:** ~1 hour
**Files:** 3 files modified
**Dependencies:** task-epic-11.112.5

## Objective

Update JavaScript to use **body-based .scm scopes** for classes. This aligns with the TypeScript changes and ensures consistent behavior across both languages.

## Motivation

**The Problem:**

- Current `.scm` captures entire class: `(class_declaration) @scope.class`
- Class name is INSIDE its own scope (wrong)

**The Solution:**

- Capture body only: `(class_declaration body: (class_body) @scope.class)`
- Class name is OUTSIDE its scope (in parent/module scope)
- Simple location containment works ✅

**Why This Matters:**

- ES6 classes need names in module scope for exports
- Import/export resolution expects module-level symbols
- Consistent with TypeScript implementation

---

## Sub-Tasks

### 11.112.6.1: Update JavaScript .scm (20 min)

Update `queries/javascript.scm` to capture class bodies only.

**Note:** JavaScript only has classes (no interfaces/enums)

### 11.112.6.2: Update JavaScript Import Resolver (10 min)

Review `import_resolver.javascript.ts` for scope assumptions.

**Expected:** No changes needed (ES6 imports work at module level)

### 11.112.6.3: Update JavaScript Import Resolver Tests (25 min)

Fix `import_resolver.javascript.test.ts` failures and add body-based scope tests.

---

## Files Modified

1. `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
2. `packages/core/src/resolve_references/import_resolution/import_resolver.javascript.ts`
3. `packages/core/src/resolve_references/import_resolution/import_resolver.javascript.test.ts`

---

## Expected Results

**Before:**

```javascript
class MyClass {
  // Scope: 1:0 to 3:1 (includes name ❌)
  method() {}
}
```

**After:**

```javascript
class MyClass {     // Scope: 1:14 to 3:1 (body only ✅)
  ^← Scope starts
  method() {}
}
```

---

## Success Criteria

- ✅ JavaScript .scm updated with body captures
- ✅ Import resolver verified
- ✅ All import resolver tests passing
- ✅ Class names in module scope
- ✅ Consistent with TypeScript implementation

---

## Next Task

**task-epic-11.112.7** - Update Python for body-based scopes

---

## Implementation Notes

**Completed:** 2025-10-06
**Estimated Time:** 1 hour
**Actual Time:** ~1 hour
**Commit:** c1b8277 `feat(scopes): Update JavaScript .scm to use body-based scopes for classes`

---

## PR Description Summary

### Problem Statement

JavaScript ES6 classes were incorrectly assigned their own scope as the `scope_id`, when they should be assigned their parent (module) scope. This is the same bug as TypeScript (task-epic-11.112.5) but for JavaScript's simpler class system (no interfaces or enums).

**Example Bug:**
```javascript
class MyClass {        // Lines 1-3
  method() {}          // Lines 2-3
}

// BUG: MyClass.scope_id = class_scope (wrong!)
// EXPECTED: MyClass.scope_id = module_scope (correct!)
```

This broke ES6 module exports and class name resolution.

### Solution

Updated JavaScript tree-sitter queries to capture **class bodies only**:

```diff
- (class_declaration) @scope.class
+ (class_declaration body: (class_body) @scope.class)
```

**Simpler than TypeScript:**
JavaScript only has classes (no interfaces or enums), so only one `.scm` pattern needed updating.

### Why This Works

**ES6 Module Semantics:**
- Class declarations are hoisted to module scope
- `export class MyClass` exports from module scope
- Class body creates scope for methods and properties
- Matches JavaScript's actual runtime behavior

**Technical Implementation:**
- Same body-based capture approach as TypeScript
- Class name location falls outside class body scope
- Module-level exports work correctly

### Implementation Details

#### Sub-task 11.112.6.1: Update JavaScript .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

**Changes:**
```scheme
; OLD: Captures entire class declaration
(class_declaration) @scope.class

; NEW: Captures only the class body
(class_declaration
  body: (class_body) @scope.class)
```

**Technical Details:**
- JavaScript only has classes (no interfaces/enums)
- Single pattern change (simpler than TypeScript's 3 patterns)
- Class expressions handled identically to class declarations
- Scope starts at opening brace `{`, ends at closing brace `}`

#### Sub-task 11.112.6.2: Review JavaScript Import Resolver ✅

**Review Result:** No changes needed

ES6 import/export resolution already operates at module level. The `resolve_import()` function looks up exported symbols in module scope.

**Verification:**
- Reviewed JavaScript-specific import resolution logic
- Confirmed ES6 export semantics align with body-based scopes
- No assumptions about class declaration scope positions

**ES6 Module Behavior:**
```javascript
// File: example.js
export class MyClass {}  // Exported from module scope

// Other file:
import { MyClass } from './example.js';  // Resolves in module scope
```

#### Sub-task 11.112.6.3: Update JavaScript Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/index_single_file/semantic_index.javascript.test.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`

**Changes:**
- Added body-based scope verification tests (commit 500b48e)
- Updated scope location assertions to expect body boundaries
- Added tests for class exports
- All JavaScript tests passing

**Test Coverage:**
- ✅ Class declarations in module scope
- ✅ Class expressions in appropriate scope
- ✅ Nested classes (name in parent scope)
- ✅ ES6 class exports
- ✅ CommonJS class exports
- ✅ Import/export resolution unchanged

### Results

**Before (Broken):**
```javascript
// File: example.js
class MyClass {
  // Scope: entire declaration (1:0 to 3:1)
  method() {}
}

// MyClass.scope_id = "class:example.js:1:6:1:13" (class's own scope ❌)
```

**After (Fixed):**
```javascript
// File: example.js
class MyClass {
  // Scope: body only (1:14 to 3:1, starts at '{')
  method() {}
}

// MyClass.scope_id = "module:example.js:1:1:4:0" (module scope ✅)
```

### Success Criteria

- ✅ JavaScript .scm updated with body-based captures
- ✅ Import resolver verified (no changes required)
- ✅ All import resolver tests passing
- ✅ Class names correctly assigned to module scope
- ✅ Consistent with TypeScript implementation
- ✅ No regressions in semantic index tests

### Impact & Benefits

**Immediate Improvements:**
1. **ES6 Exports Fixed**: Class exports now resolve correctly
2. **Consistent with TypeScript**: Same scoping behavior across languages
3. **Simpler Implementation**: JavaScript has fewer constructs than TypeScript
4. **Module Semantics**: Matches JavaScript's actual runtime behavior

**Test Results:**
- JavaScript semantic index tests: All passing ✅
- Import resolution tests: All passing ✅
- Consistent with TypeScript body-based scopes

**ES6 Module Examples:**
```javascript
// Named export
export class MyClass {}  // MyClass in module scope ✅

// Default export
export default class MyClass {}  // MyClass in module scope ✅

// Re-export
export { MyClass } from './other.js';  // Resolves correctly ✅
```

### JavaScript-Specific Notes

**Class vs Class Expression:**
Both handled correctly by body-based scopes:
```javascript
// Class declaration
class MyClass {  }  // MyClass in module scope ✅

// Class expression (named)
const MyClass = class MyClass { };  // Outer MyClass in module scope ✅

// Class expression (anonymous)
const MyClass = class { };  // MyClass in module scope ✅
```

**CommonJS vs ES6:**
Body-based scopes work for both module systems:
```javascript
// CommonJS
module.exports = class MyClass {};  // MyClass in module scope ✅

// ES6
export class MyClass {}  // MyClass in module scope ✅
```

**No Interfaces/Enums:**
JavaScript's simpler type system means only classes needed updating. TypeScript required updates for classes, interfaces, and enums.

### Consistency with TypeScript

Both languages now use identical body-based scope patterns:
- **TypeScript**: Classes, interfaces, enums
- **JavaScript**: Classes only

This consistency simplifies maintenance and ensures predictable behavior across TypeScript and JavaScript codebases.

### Related Work

- **Parent Task**: epic-11.112 (Scope System Consolidation)
- **Follows**: task-epic-11.112.5 (TypeScript body-based scopes)
- **Enables**:
  - task-epic-11.112.7 (Python body-based scopes)
  - task-epic-11.112.8 (Rust body-based scopes)
- **Consistent With**: TypeScript implementation pattern
