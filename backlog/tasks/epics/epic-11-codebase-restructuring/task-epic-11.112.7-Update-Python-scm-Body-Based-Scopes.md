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
**Estimated Time:** 1 hour
**Actual Time:** ~1 hour
**Commits:**
- 5796cbf `feat(scopes): Update Python .scm to use body-based scopes for classes`
- 7d467ca `test(python): Add body-based scope verification tests for import resolver`
- e163875 `test(python): Add Python body-based scope verification tests`

---

## PR Description Summary

### Problem Statement

Python classes were incorrectly assigned their own scope as the `scope_id`, when they should be assigned their parent scope (module or containing class). This is the same fundamental bug as TypeScript/JavaScript, but Python requires different tree-sitter syntax due to indentation-based blocks.

**Example Bug:**
```python
class MyClass:         # Lines 1-3
    def method(self):  # Lines 2-3
        pass

# BUG: MyClass.scope_id = class_scope (wrong!)
# EXPECTED: MyClass.scope_id = module_scope (correct!)
```

This broke Python module imports and nested class resolution.

### Solution

Updated Python tree-sitter queries to capture **class bodies only**:

```diff
- (class_definition) @scope.class
+ (class_definition body: (block) @scope.class)
```

**Python-Specific:**
Python uses indented `block` nodes instead of brace-delimited bodies. The `block` starts after the `:` and includes all indented content.

### Why This Works

**Python Scoping Semantics:**
- Class names are defined in their enclosing scope (module or parent class)
- `from module import MyClass` imports from module scope
- Class body creates new scope for methods and nested classes
- Matches Python's actual runtime behavior

**Indentation-Based Scoping:**
- Python's `block` node represents indented code blocks
- Scope boundary aligns with indentation level
- Tree-sitter automatically handles whitespace

### Implementation Details

#### Sub-task 11.112.7.1: Update Python .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

**Changes:**
```scheme
; OLD: Captures entire class definition
(class_definition) @scope.class

; NEW: Captures only the class body (indented block)
(class_definition
  body: (block) @scope.class)
```

**Technical Details:**
- Python uses `block` nodes (indentation) instead of `{ }` braces
- Scope starts after colon `:` where indentation begins
- Scope ends when indentation returns to class definition level
- Handles nested classes automatically (inner class definition inside outer class `block`)

**Indentation Example:**
```python
class MyClass:  # ← Colon marks end of class name
    # ← Scope starts here (indented block)
    def method(self):
        pass
# ← Scope ends here (dedent to module level)
```

#### Sub-task 11.112.7.2: Review Python Import Resolver ✅

**Review Result:** No changes needed

Python import resolution already operates at module level. The `resolve_import()` function looks up imported names in module scope.

**Verification:**
- Reviewed Python-specific import resolution logic
- Confirmed `from module import Class` expects class in module scope
- Nested classes correctly placed in parent class scope
- Body-based scopes align with Python's actual import behavior

**Analysis Document:**
Created comprehensive documentation analyzing Python resolver behavior (commit 6e5d56d)

**Python Import Examples:**
```python
# File: example.py
class MyClass:  # MyClass in module scope ✅
    pass

# Other file:
from example import MyClass  # Resolves in module scope ✅
```

#### Sub-task 11.112.7.3: Update Python Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/index_single_file/semantic_index.python.test.ts`

**Changes:**
- Added comprehensive body-based scope verification tests (commits 7d467ca, e163875)
- Updated scope location assertions to expect body-based boundaries
- Added nested class verification tests
- Added tests for indentation-based scope boundaries
- All Python tests passing

**Test Coverage:**
- ✅ Class definitions in module scope
- ✅ Nested classes in parent class scope
- ✅ Methods in class scope
- ✅ Function-local classes in function scope
- ✅ Import/from statements resolve correctly
- ✅ Indentation-based scope boundaries

### Results

**Before (Broken):**
```python
# File: example.py
class MyClass:
    # Scope: entire definition (1:0 to 3:13)
    def method(self):
        x = 1

# MyClass.scope_id = "class:example.py:1:6:1:13" (class's own scope ❌)
```

**After (Fixed):**
```python
# File: example.py
class MyClass:
    # Scope: body only (1:13 to 3:13, starts after ':')
    def method(self):
        x = 1

# MyClass.scope_id = "module:example.py:1:1:4:0" (module scope ✅)
```

### Success Criteria

- ✅ Python .scm updated with body-based captures
- ✅ Import resolver verified (no changes required)
- ✅ All import resolver tests passing
- ✅ Class names correctly assigned to parent scope
- ✅ Nested classes handled correctly
- ✅ Indentation-based scope boundaries work correctly
- ✅ No regressions in semantic index tests

### Impact & Benefits

**Immediate Improvements:**
1. **Import Resolution Fixed**: `from module import Class` now works correctly
2. **Nested Classes Fixed**: Inner classes now correctly reference outer class scope
3. **Indentation Handling**: Scope boundaries align with Python's indentation rules
4. **Consistent with TypeScript/JavaScript**: Same conceptual approach across all languages

**Test Results:**
- Python semantic index tests: All passing ✅
- Import resolution tests: All passing ✅
- Nested class tests: All passing ✅
- Consistent with TypeScript/JavaScript body-based scopes

**Python Import Examples:**
```python
# Named import
from example import MyClass  # MyClass in module scope ✅

# Module import
import example
example.MyClass  # Resolves to module.MyClass ✅

# Nested class
class Outer:
    class Inner:  # Inner in Outer's class scope ✅
        pass
```

### Python-Specific Notes

**Indentation-Based Scoping:**
Python's unique syntax requires different tree-sitter nodes than brace-based languages:
```python
class MyClass:  # ← Name ends here
    # ← Scope starts here (after colon, at indent)
    def method(self):
        pass
# ← Scope ends here (dedent to module level)
```

**Nested Classes:**
Body-based scopes handle nested classes correctly:
```python
class Outer:          # Outer.scope_id = module_scope ✅
    class Inner:      # Inner.scope_id = outer_class_body_scope ✅
        class Deep:   # Deep.scope_id = inner_class_body_scope ✅
            pass
```

**Function-Local Classes:**
Classes defined inside functions get function scope:
```python
def factory():        # factory in module scope
    class Local:      # Local.scope_id = function_body_scope ✅
        pass
    return Local
```

**Block Node Structure:**
Tree-sitter's `block` node captures indented content:
- Starts after `:` (colon)
- Includes all indented lines
- Ends at dedent (return to parent indentation level)
- Handles blank lines and comments correctly

### Differences from TypeScript/JavaScript

| Aspect | TypeScript/JavaScript | Python |
|--------|----------------------|--------|
| Body delimiter | `{ }` braces | Indentation |
| Tree-sitter node | `class_body`, `object_type` | `block` |
| Scope start | Opening brace `{` | After colon `:` |
| Scope end | Closing brace `}` | Dedent |
| Nested constructs | Interfaces, enums | Only classes |

Despite these differences, the **conceptual approach is identical**: capture bodies only, not entire declarations.

### Related Work

- **Parent Task**: epic-11.112 (Scope System Consolidation)
- **Follows**:
  - task-epic-11.112.5 (TypeScript body-based scopes)
  - task-epic-11.112.6 (JavaScript body-based scopes)
- **Enables**: task-epic-11.112.8 (Rust body-based scopes)
- **Pattern**: Same body-based approach adapted for Python's syntax
