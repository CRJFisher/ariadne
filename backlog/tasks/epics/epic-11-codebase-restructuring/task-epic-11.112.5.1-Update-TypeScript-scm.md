# Task epic-11.112.5.1: Update TypeScript .scm for Body-Based Scopes

**Parent:** task-epic-11.112.5
**Status:** Completed
**Estimated Time:** 30 minutes
**Files:** 1 file modified

## Objective

Update the TypeScript tree-sitter query file to capture scope **bodies** instead of entire declarations for classes, interfaces, and enums.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

---

## The Fix

### Current Problem
```scheme
(class_declaration) @scope.class
```

This captures the ENTIRE class:
```typescript
class MyClass {  // ← Scope includes name (wrong!)
  method() {}
}
```

### Solution
```scheme
(class_declaration
  body: (class_body) @scope.class
)
```

This captures only the BODY:
```typescript
class MyClass {  // ← Name is before scope
  ^← Scope starts here (correct!)
  method() {}
}
```

---

## Implementation Steps

### 1. Locate Current Scope Captures (5 min)

Find these patterns in `typescript.scm`:
```scheme
(class_declaration) @scope.class
(interface_declaration) @scope.interface
(enum_declaration) @scope.enum
```

### 2. Update Class Scope Capture (5 min)

```scheme
# BEFORE
(class_declaration) @scope.class

# AFTER
(class_declaration
  body: (class_body) @scope.class
)
```

**Why:** Class name should be in parent scope, only the body `{...}` creates its own scope.

### 3. Update Interface Scope Capture (5 min)

```scheme
# BEFORE
(interface_declaration) @scope.interface

# AFTER
(interface_declaration
  body: (object_type) @scope.interface
)
```

**Why:** Interface name should be in parent scope, only the body `{...}` creates its own scope.

### 4. Update Enum Scope Capture (5 min)

```scheme
# BEFORE
(enum_declaration) @scope.enum

# AFTER
(enum_declaration
  body: (enum_body) @scope.enum
)
```

**Why:** Enum name should be in parent scope, only the body `{...}` creates its own scope.

### 5. Verify Grammar Fields (5 min)

Check tree-sitter-typescript grammar to confirm field names:
- Class has `body: (class_body)` ✅
- Interface has `body: (object_type)` ✅
- Enum has `body: (enum_body)` ✅

You can verify with:
```bash
npx tree-sitter parse --scope source.ts --query 'class MyClass {}'
```

### 6. Test with Simple Example (5 min)

Create test file `test.ts`:
```typescript
class MyClass {
  method() {}
}
```

Run semantic indexer and verify scope locations:
- Class scope should start at `{` (after "MyClass")
- Class name location should be OUTSIDE class scope
- Method scope should be INSIDE class scope

---

## Expected Scope Locations

**Before Change:**
```
class MyClass {     // class scope: 1:0 to 3:1 (includes name ❌)
  method() {}       // method scope: 2:2 to 2:15
}
```

**After Change:**
```
class MyClass {     // class scope: 1:14 to 3:1 (body only ✅)
  method() {}       // method scope: 2:2 to 2:15
}
```

---

## Why This Works

### Location Containment

With body-based scopes:
- Class name at `1:6:1:13` ("MyClass")
- Class scope at `1:14:3:1` (the `{...}`)
- Name is OUTSIDE class scope ✅
- `get_scope_id()` finds parent scope via simple containment ✅

### No Heuristics Needed

```typescript
get_scope_id(location: Location): ScopeId {
  // Find deepest scope containing location
  // For "MyClass" at 1:6:
  //   - Class body scope 1:14:3:1 doesn't contain 1:6 ❌
  //   - File scope 1:0:10:0 contains 1:6 ✅
  // Returns file scope ✅
}
```

---

## Common Patterns

### Classes with Inheritance
```scheme
(class_declaration
  body: (class_body) @scope.class
)
```
Works for:
- `class Foo {}`
- `class Foo extends Bar {}`
- `class Foo implements IBar {}`
- `class Foo<T> extends Bar<T> {}`

### Interfaces with Extension
```scheme
(interface_declaration
  body: (object_type) @scope.interface
)
```
Works for:
- `interface IFoo {}`
- `interface IFoo extends IBar {}`
- `interface IFoo<T> {}`

### Enums
```scheme
(enum_declaration
  body: (enum_body) @scope.enum
)
```
Works for:
- `enum Status { A, B }`
- `const enum Status { A, B }`

---

## Success Criteria

- ✅ Classes capture only `class_body` as scope
- ✅ Interfaces capture only `interface_body` as scope (corrected from `object_type`)
- ✅ Enums capture only `enum_body` as scope
- ✅ Grammar field names verified
- ✅ Simple test case verified
- ✅ Ready for import resolver updates

---

## Implementation Notes

### Changes Made

**File:** `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`

1. **Class Scopes** (lines 28-36):
   ```scheme
   (class_declaration
     body: (class_body) @scope.class
   )
   (abstract_class_declaration
     body: (class_body) @scope.class
   )
   (class
     body: (class_body) @scope.class
   )
   ```

2. **Interface Scopes** (lines 39-41):
   ```scheme
   (interface_declaration
     body: (interface_body) @scope.interface
   )
   ```
   **Note:** Initial plan specified `object_type`, but AST inspection revealed the correct field is `interface_body`.

3. **Enum Scopes** (lines 42-44):
   ```scheme
   (enum_declaration
     body: (enum_body) @scope.enum
   )
   ```

### Verification Results

#### AST Field Name Verification
Created `inspect_ast.ts` to verify tree-sitter-typescript grammar field names:
- ✅ `class_declaration` has `body: (class_body)`
- ✅ `interface_declaration` has `body: (interface_body)` (NOT `object_type`)
- ✅ `enum_declaration` has `body: (enum_body)`

#### Test Suite Created
**File:** `packages/core/src/index_single_file/scopes/body_based_scope_verification.test.ts`

Comprehensive test suite with 4 test cases:
1. **Class Body-Based Scope** - Verifies class scope starts at column 15 (body `{`)
2. **Interface Body-Based Scope** - Verifies interface scope starts at column 16 (body `{`)
3. **Enum Body-Based Scope** - Verifies enum scope starts at column 13 (body `{`)
4. **Complex Class** - Verifies classes with multiple fields/methods work correctly

**All 4 tests passing** ✅

#### Test Results Summary

```
Class scope verification:
  - Scope location: 1:15 to 3:2 (starts at `{`, not at `class` keyword)
  - Class name "MyClass" scope_id: module:test.ts:1:1:3:1 (in module scope ✅)
  - Class name location: 1:7 to 1:14 (BEFORE scope starts ✅)

Interface scope verification:
  - Scope location: 1:16 to 3:2 (starts at `{`)
  - Interface name "IFoo" in module scope ✅

Enum scope verification:
  - Scope location: 1:13 to 4:2 (starts at `{`)
  - Enum name "Status" in module scope ✅
```

#### Compilation Verification

✅ **TypeScript Builder Tests**: 21/21 passing
✅ **Semantic Index TypeScript Tests**: 38/38 passing
✅ **Core Package Build**: Successful
```bash
npm run build
✓ tsc compilation succeeded
✓ .scm files copied to dist/
```

#### Key Discovery

Interface and enum scopes are stored with type `"class"` in the scope system (see `scope_processor.ts:188-213`), not as separate `"interface"` or `"enum"` types. This is a design decision in the existing codebase that consolidates all type-level scopes under the `"class"` type.

### Impact

This change enables correct type resolution via simple location containment:
- Class/interface/enum **names** are now in parent (module) scope
- Class/interface/enum **members** are in body scope
- `get_scope_id()` can find the correct scope using pure containment logic
- No special heuristics needed to handle "creates_scope" patterns

---

## Next Sub-Task

**task-epic-11.112.5.2** - Update TypeScript import resolver
