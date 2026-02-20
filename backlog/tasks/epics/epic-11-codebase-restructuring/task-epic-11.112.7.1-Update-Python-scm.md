# Task epic-11.112.7.1: Update Python .scm for Body-Based Scopes

**Parent:** task-epic-11.112.7
**Status:** Completed
**Estimated Time:** 20 minutes
**Actual Time:** 15 minutes
**Files:** 2 files modified (1 source + 1 test)

## Objective

Update the Python tree-sitter query file to capture scope **bodies** instead of entire declarations for classes. Python uses `block` nodes for class bodies.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`

---

## The Fix

### Current Problem
```scheme
(class_definition) @scope.class
```

Captures the ENTIRE class including the name.

### Solution
```scheme
(class_definition
  body: (block) @scope.class
)
```

Captures only the BODY (the indented block).

---

## Implementation Steps

### 1. Locate Current Scope Capture (3 min)

Find this pattern in `python.scm`:
```scheme
(class_definition) @scope.class
```

**Note:** Python uses `block` for class bodies (indented code), not `class_body`.

### 2. Update Class Scope Capture (5 min)

```scheme
# BEFORE
(class_definition) @scope.class

# AFTER
(class_definition
  body: (block) @scope.class
)
```

### 3. Verify Grammar Fields (2 min)

Check tree-sitter-python grammar:
- `class_definition` has `body: (block)` ✅

### 4. Test with Simple Example (10 min)

Create test file `test.py`:
```python
class MyClass:
    def method(self):
        x = 1
```

Verify:
- Class scope starts at the colon `:` (where block begins)
- Class name "MyClass" is OUTSIDE class scope
- Method scope is INSIDE class scope

---

## Expected Scope Locations

**Before:**
```python
class MyClass:        # class scope: 1:0 to 3:13 (includes name ❌)
    def method(self):
        x = 1
```

**After:**
```python
class MyClass:        # class scope: 1:13 to 3:13 (body only ✅)
    def method(self):
        x = 1
```

---

## Python-Specific Notes

Python uses indentation for blocks:
```python
class Foo:     # ← Scope starts after ':'
    x = 1      # ← Block begins (indented)
```

The `(block)` node represents the indented suite.

---

## Success Criteria

- ✅ Classes capture only `block` as scope
- ✅ Grammar field names verified
- ✅ Test case verified
- ✅ Ready for import resolver updates

---

## Implementation Notes

### Changes Made

1. **Updated python.scm (line 26-28)**
   ```scheme
   ; BEFORE
   (class_definition) @scope.class

   ; AFTER
   (class_definition
     body: (block) @scope.class
   )
   ```

2. **Added Python tests to body_based_scope_verification.test.ts**
   - Created test section "Python Class Body-Based Scope"
   - Test 1: Simple class with single method
   - Test 2: Complex class with multiple methods
   - All tests pass ✅

### Verification Results

**Grammar Validation:**
- ✅ tree-sitter-python v0.21.0 confirmed
- ✅ `class_definition` has field `body: $._suite`
- ✅ `_suite` is aliased to `block` node
- ✅ Pattern syntax is valid

**Test Results:**
```
Python Class Body-Based Scope Verification
- Class scope starts at line 2 (after ':'), not line 1
- Class name 'MyClass' scope_id: 'module:test.py:1:1:3:12' (module scope ✅)
- Class scope id: 'class:test.py:2:5:3:13' (body only ✅)
- Class scope parent: module scope ✅
```

**TypeScript Compilation:**
- ✅ 0 errors in query_code_tree files
- ✅ python.scm loads without syntax errors
- ✅ Query object creates successfully

### Scope Behavior

**Before:** Class scope included class name
```python
class MyClass:        # scope: 1:1 to 3:12 (includes "MyClass" ❌)
    def method(self):
        pass
```

**After:** Class scope is body only
```python
class MyClass:        # "MyClass" in module scope ✅
                      # scope starts: 2:5 (indented block ✅)
    def method(self):
        pass
```

### Key Differences from TypeScript/JavaScript

- **TypeScript/JavaScript:** Body starts at `{` on same line
  ```typescript
  class MyClass {    // scope: 1:15 (at brace)
    method() {}
  }
  ```

- **Python:** Body starts at next line (indented block)
  ```python
  class MyClass:     // scope: 2:5 (next line, indented)
      def method(self):
          pass
  ```

### Files Modified

1. **packages/core/src/index_single_file/query_code_tree/queries/python.scm**
   - Line 26-28: Updated class scope capture to use body-based approach

2. **packages/core/src/index_single_file/scopes/body_based_scope_verification.test.ts**
   - Added Python import
   - Added "Python Class Body-Based Scope" test section (2 test cases)
   - 8/8 tests passing

---

## Next Sub-Task

**task-epic-11.112.7.2** - Update Python import resolver
