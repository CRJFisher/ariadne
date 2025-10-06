# Task epic-11.112.7: Update Python for Body-Based Scopes

**Parent:** task-epic-11.112
**Status:** Done
**Estimated Time:** 1 hour
**Actual Time:** ~1 hour
**Files:** 3 files modified
**Dependencies:** task-epic-11.112.6

## Objective

Update Python to use **body-based .scm scopes** for classes. Python uses `block` (indented code) as the body node.

## Motivation

**The Problem:**
- Current `.scm` captures entire class: `(class_definition) @scope.class`
- Class name is INSIDE its own scope (wrong)

**The Solution:**
- Capture body only: `(class_definition body: (block) @scope.class)`
- Class name is OUTSIDE its scope (in parent/module scope)
- Simple location containment works ✅

**Why This Matters:**
- Python classes need names in module scope for imports
- Nested classes need names in parent class scope
- Consistent with TypeScript/JavaScript implementation

---

## Sub-Tasks

### 11.112.7.1: Update Python .scm (20 min)
Update `queries/python.scm` to capture class bodies (`block` nodes).

**Note:** Python uses indentation, not braces

### 11.112.7.2: Update Python Import Resolver (10 min)
Review `import_resolver.python.ts` for scope assumptions.

**Special attention:** Nested class handling

### 11.112.7.3: Update Python Import Resolver Tests (25 min)
Fix `import_resolver.python.test.ts` failures and add body-based scope tests.

---

## Files Modified

1. `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
2. `packages/core/src/resolve_references/import_resolution/import_resolver.python.ts`
3. `packages/core/src/resolve_references/import_resolution/import_resolver.python.test.ts`

---

## Expected Results

**Before:**
```python
class MyClass:        # Scope: 1:0 to 3:13 (includes name ❌)
    def method(self):
        x = 1
```

**After:**
```python
class MyClass:        # Scope: 1:13 to 3:13 (body only ✅)
    ^← Scope starts (after ':')
    def method(self):
        x = 1
```

---

## Success Criteria

- ✅ Python .scm updated with body captures
- ✅ Import resolver verified
- ✅ All import resolver tests passing
- ✅ Class names in module scope
- ✅ Nested classes handled correctly

---

## Next Task

**task-epic-11.112.8** - Update Rust for body-based scopes

---

## Implementation Notes

**Completed:** 2025-10-06
**Commits:**
- 5796cbf `feat(scopes): Update Python .scm to use body-based scopes for classes`
- 7d467ca `test(python): Add body-based scope verification tests for import resolver`
- e163875 `test(python): Add Python body-based scope verification tests`

### Work Completed

#### Sub-task 11.112.7.1: Update Python .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Changes:**
- Updated class captures to use `body: (block) @scope.class`
- Python uses indented `block` nodes as bodies (not braces)
- Handles nested classes correctly (outer class body contains inner class definition)

**Result:** Class names now correctly placed in parent scope (module or parent class), bodies create scopes

#### Sub-task 11.112.7.2: Update Python Import Resolver ✅

**Review Result:** No changes needed

Python import resolution already works at module level. Nested classes correctly placed in parent class scope. Body-based scopes align with Python's indentation-based scoping.

**Analysis:** Created comprehensive documentation on Python resolver behavior (commit 6e5d56d)

#### Sub-task 11.112.7.3: Update Python Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/index_single_file/semantic_index.python.test.ts`

**Changes:**
- Added comprehensive body-based scope verification tests (commits 7d467ca, e163875)
- Updated scope location assertions to expect body-based scopes
- Added nested class verification tests
- All Python tests passing

### Results

**Before:**
```python
class MyClass:        # Scope: 1:0 to 3:13 (includes name ❌)
    def method(self):
        x = 1
# MyClass.scope_id = class_scope (wrong!)
```

**After:**
```python
class MyClass:        # Scope: 1:13 to 3:13 (body only ✅)
    def method(self):
        x = 1
# MyClass.scope_id = module_scope (correct!)
```

### Success Criteria Met

- ✅ Python .scm updated with body captures
- ✅ Import resolver verified (no changes needed)
- ✅ All import resolver tests passing
- ✅ Class names in module scope
- ✅ Nested classes handled correctly

### Python-Specific Notes

**Indentation Handling:**
- Python uses `block` nodes instead of brace-delimited bodies
- Scope starts after `:` and includes all indented content
- Works correctly with Python's whitespace-sensitive syntax

**Nested Classes:**
```python
class Outer:          # Outer.scope_id = module_scope ✅
    class Inner:      # Inner.scope_id = outer_class_scope ✅
        pass
```

### Impact

- Python class exports now work correctly with type resolution
- Nested class resolution fixed
- Consistent behavior with TypeScript/JavaScript
- Foundation for Rust updates
