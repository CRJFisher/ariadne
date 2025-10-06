# Task epic-11.112.6.1: Update JavaScript .scm for Body-Based Scopes

**Parent:** task-epic-11.112.6
**Status:** Completed
**Estimated Time:** 20 minutes
**Actual Time:** 15 minutes
**Files:** 1 file modified, 1 test file updated

## Objective

Update the JavaScript tree-sitter query file to capture scope **bodies** instead of entire declarations for classes.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

---

## The Fix

### Current Problem
```scheme
(class_declaration) @scope.class
```

Captures the ENTIRE class including the name.

### Solution
```scheme
(class_declaration
  body: (class_body) @scope.class
)
```

Captures only the BODY, making the class name visible in the parent scope.

---

## Implementation Steps

### 1. Locate Current Scope Captures (3 min)

Find this pattern in `javascript.scm`:
```scheme
(class_declaration) @scope.class
```

Note: JavaScript doesn't have interfaces or enums (those are TypeScript features).

### 2. Update Class Scope Capture (5 min)

```scheme
# BEFORE
(class_declaration) @scope.class

# AFTER
(class_declaration
  body: (class_body) @scope.class
)
```

### 3. Check for Class Expressions (5 min)

May also need to update class expressions if they exist:
```scheme
(class
  body: (class_body) @scope.class
)
```

### 4. Verify Grammar Fields (2 min)

Check tree-sitter-javascript grammar:
- Class has `body: (class_body)` ✅

### 5. Test with Simple Example (5 min)

Create test file `test.js`:
```javascript
class MyClass {
  method() {}
}
```

Verify:
- Class scope starts at `{` (after "MyClass")
- Class name location is OUTSIDE class scope
- Method scope is INSIDE class scope

---

## Expected Scope Locations

**Before:**
```
class MyClass {     // class scope: 1:0 to 3:1 (includes name ❌)
  method() {}
}
```

**After:**
```
class MyClass {     // class scope: 1:14 to 3:1 (body only ✅)
  method() {}
}
```

---

## Success Criteria

- ✅ Classes capture only `class_body` as scope
- ✅ Grammar field names verified
- ✅ Test case verified
- ✅ Ready for import resolver updates

---

## Implementation Notes

### Changes Made

1. **Updated `javascript.scm`** (lines 22-28):
   - Changed `(class_declaration) @scope.class` to `(class_declaration body: (class_body) @scope.class)`
   - Changed `(class) @scope.class` to `(class body: (class_body) @scope.class)`
   - Both class declarations and class expressions now capture only the body

2. **Added JavaScript tests** to `body_based_scope_verification.test.ts`:
   - Added test for class declaration body-based scoping
   - Added test for class expression body-based scoping
   - All tests pass ✅

### Test Results

JavaScript class declaration:
```
Class scope: 1:15 to 3:2 (body only ✅)
Class name 'MyClass': in module scope ✅
```

JavaScript class expression:
```
Class scope: 1:23 to 3:2 (body only ✅)
```

Both match expected behavior from TypeScript implementation.

### TypeScript Compilation

✅ **Verified** - No TypeScript errors in files that use `javascript.scm`:
- `javascript_metadata.ts` - compiles cleanly
- `javascript_builder.ts` - compiles cleanly
- `.scm` file is loaded as text at runtime, not compiled

All TypeScript errors are pre-existing in unrelated dependency files.

---

## Next Sub-Task

**task-epic-11.112.6.2** - Update JavaScript import resolver
