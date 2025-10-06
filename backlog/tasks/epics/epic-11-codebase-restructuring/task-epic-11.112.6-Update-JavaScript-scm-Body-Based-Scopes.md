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
**Commit:** c1b8277 `feat(scopes): Update JavaScript .scm to use body-based scopes for classes`

### Work Completed

#### Sub-task 11.112.6.1: Update JavaScript .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

**Changes:**
- Updated class captures to use `body: (class_body) @scope.class`
- JavaScript only has classes (no interfaces/enums like TypeScript)

**Result:** Class names now correctly placed in module scope, bodies create scopes

#### Sub-task 11.112.6.2: Update JavaScript Import Resolver ✅

**Review Result:** No changes needed

ES6 import/export resolution already works at module level. Body-based scopes align perfectly with JavaScript module semantics.

#### Sub-task 11.112.6.3: Update JavaScript Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/index_single_file/semantic_index.javascript.test.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`

**Changes:**
- Added body-based scope verification tests (commit 500b48e)
- Updated scope location assertions
- All JavaScript tests passing

### Results

**Before:**
```javascript
class MyClass {
  // Scope: 1:0 to 3:1 (includes name ❌)
  method() {}
}
// MyClass.scope_id = class_scope (wrong!)
```

**After:**
```javascript
class MyClass {     // Scope: 1:14 to 3:1 (body only ✅)
  method() {}
}
// MyClass.scope_id = module_scope (correct!)
```

### Success Criteria Met

- ✅ JavaScript .scm updated with body captures
- ✅ Import resolver verified (no changes needed)
- ✅ All import resolver tests passing
- ✅ Class names in module scope
- ✅ Consistent with TypeScript implementation

### Impact

- ES6 class exports now work correctly with type resolution
- Consistent behavior with TypeScript
- Foundation for Python and Rust updates
