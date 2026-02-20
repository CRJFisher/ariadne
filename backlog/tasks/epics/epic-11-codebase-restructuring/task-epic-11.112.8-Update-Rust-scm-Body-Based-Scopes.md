# Task epic-11.112.8: Update Rust for Body-Based Scopes

**Parent:** task-epic-11.112
**Status:** Done
**Estimated Time:** 1 hour 15 minutes
**Actual Time:** ~1 hour 15 minutes
**Files:** 3 files modified
**Dependencies:** task-epic-11.112.7

## Objective

Update Rust to use **body-based .scm scopes** for structs, enums, traits, and impls. Rust has more scope-creating constructs than other languages.

## Motivation

**The Problem:**
- Current `.scm` captures entire declarations: `(struct_item) @scope.struct`
- Type names are INSIDE their own scopes (wrong)

**The Solution:**
- Capture bodies only: `(struct_item body: (field_declaration_list) @scope.struct)`
- Type names are OUTSIDE their scopes (in parent/module scope)
- Simple location containment works ✅

**Why This Matters:**
- Rust modules export types from module scope
- Import resolution expects module-level symbols
- Impl blocks need correct scope boundaries
- Consistent with other language implementations

---

## Sub-Tasks

### 11.112.8.1: Update Rust .scm (30 min)
Update `queries/rust.scm` to capture bodies for structs, enums, traits, impls.

**Note:** Rust has more constructs than other languages

### 11.112.8.2: Update Rust Import Resolver (15 min)
Review `import_resolver.rust.ts` for scope assumptions.

**Expected:** No changes needed (use statements work at module level)

### 11.112.8.3: Update Rust Import Resolver Tests (30 min)
Fix `import_resolver.rust.test.ts` failures and add body-based scope tests.

---

## Files Modified

1. `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`
2. `packages/core/src/resolve_references/import_resolution/import_resolver.rust.ts`
3. `packages/core/src/resolve_references/import_resolution/import_resolver.rust.test.ts`

---

## Expected Results

**Before:**
```rust
struct MyStruct {  // Scope: 1:0 to 3:1 (includes name ❌)
    field: i32
}
```

**After:**
```rust
struct MyStruct {  // Scope: 1:16 to 3:1 (body only ✅)
    ^← Scope starts
    field: i32
}
```

---

## Rust-Specific Notes

**Struct Variants:**
- Regular struct `struct Point { x: i32 }` - has body ✅
- Tuple struct `struct Point(i32)` - no body (no scope)
- Unit struct `struct Unit;` - no body (no scope)

Body-based capture automatically handles all variants.

**Impl Blocks:**
```rust
impl MyStruct {              // impl scope: body only
    fn new() -> Self { }     // in impl scope
}
```

---

## Success Criteria

- ✅ Rust .scm updated with body captures
- ✅ Import resolver verified
- ✅ All import resolver tests passing
- ✅ Type names in module scope
- ✅ Impl blocks handled correctly

---

## Next Task

**task-epic-11.112.9** - Clean up get_scope_id implementation

---

## Implementation Notes

**Completed:** 2025-10-06
**Estimated Time:** 1 hour 15 minutes
**Actual Time:** ~1 hour 15 minutes
**Commits:**
- 7742422 `refactor(rust): Update Rust .scm to use body-based scopes for structs, enums, traits, and impls`
- e0f61b3 `test(rust): Add comprehensive body-based scope tests to import resolver`

---

## PR Description Summary

### Problem Statement

Rust structs, enums, traits, and impl blocks were incorrectly assigned their own scope as the `scope_id`, when they should be assigned their parent (module) scope. This is the same fundamental bug as TypeScript/JavaScript/Python, but Rust has more scope-creating constructs to handle.

**Example Bug:**
```rust
struct MyStruct {      // Lines 1-3
    field: i32         // Line 2
}

// BUG: MyStruct.scope_id = struct_scope (wrong!)
// EXPECTED: MyStruct.scope_id = module_scope (correct!)
```

This broke Rust module exports, trait resolution, and impl block method resolution.

### Solution

Updated Rust tree-sitter queries to capture **bodies only** for all type-defining constructs:

```diff
- (struct_item) @scope.struct
+ (struct_item body: (field_declaration_list) @scope.struct)

- (enum_item) @scope.enum
+ (enum_item body: (enum_variant_list) @scope.enum)

- (trait_item) @scope.trait
+ (trait_item body: (declaration_list) @scope.trait)

- (impl_item) @scope.impl
+ (impl_item body: (declaration_list) @scope.impl)
```

**Rust-Specific:**
Rust has more type-defining constructs than other languages (structs, enums, traits, impls), but body-based capture handles all of them uniformly.

### Why This Works

**Rust Module Semantics:**
- Type names (structs, enums, traits) are declared in module scope
- `use module::MyStruct` imports from module scope
- Impl blocks don't create named types, but do create scopes for methods
- Type bodies create scopes for fields/methods/associated items
- Matches Rust's actual visibility and name resolution rules

**Automatic Struct Variant Handling:**
Body-based captures automatically handle all struct variants:
```rust
struct Regular { x: i32 }  // Has field_declaration_list → creates scope
struct Tuple(i32);         // No field_declaration_list → no scope
struct Unit;               // No body → no scope
```

### Implementation Details

#### Sub-task 11.112.8.1: Update Rust .scm ✅

**Modified Files:**
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`

**Changes:**
```scheme
; Structs: Capture field lists only
(struct_item
  body: (field_declaration_list) @scope.struct)

; Enums: Capture variant lists only
(enum_item
  body: (enum_variant_list) @scope.enum)

; Traits: Capture declaration lists only
(trait_item
  body: (declaration_list) @scope.trait)

; Impls: Capture declaration lists only
(impl_item
  body: (declaration_list) @scope.impl)
```

**Technical Details:**
- **Structs**: `field_declaration_list` contains named fields `{ x: i32, y: i32 }`
- **Enums**: `enum_variant_list` contains enum variants `{ Variant1, Variant2 }`
- **Traits**: `declaration_list` contains trait method signatures
- **Impls**: `declaration_list` contains method implementations
- Scope starts at opening brace `{`, ends at closing brace `}`

**Struct Variant Handling:**
```rust
// Regular struct - has field_declaration_list ✅
struct Point { x: i32, y: i32 }  // Creates scope for fields

// Tuple struct - no field_declaration_list ✅
struct Point(i32, i32);  // No scope created (no body captured)

// Unit struct - no body ✅
struct Unit;  // No scope created (no body to capture)
```

Body-based capture automatically handles all variants without special logic!

#### Sub-task 11.112.8.2: Review Rust Import Resolver ✅

**Review Result:** No changes needed

Rust `use` statements work at module level. The `resolve_import()` function looks up imported names in module scope, which is where struct/enum/trait names now correctly reside.

**Verification:**
- Reviewed Rust-specific import resolution logic
- Confirmed `use module::Type` expects type in module scope
- Impl blocks create scopes but don't export names (correct behavior)
- Body-based scopes align with Rust's module system

**Rust Import Examples:**
```rust
// File: example.rs
pub struct MyStruct { field: i32 }  // MyStruct in module scope ✅

// Other file:
use example::MyStruct;  // Resolves in module scope ✅
```

#### Sub-task 11.112.8.3: Update Rust Import Resolver Tests ✅

**Modified Files:**
- `packages/core/src/index_single_file/semantic_index.rust.test.ts`

**Changes:**
- Added comprehensive body-based scope verification tests (commit e0f61b3)
- Tests cover structs, enums, traits, and impl blocks
- Updated scope location assertions to expect body boundaries
- Added tests for all struct variants (regular, tuple, unit)
- Added tests for generic types
- All Rust tests passing

**Test Coverage:**
- ✅ Regular structs in module scope
- ✅ Tuple structs in module scope (no scope created)
- ✅ Unit structs in module scope (no scope created)
- ✅ Enums in module scope
- ✅ Traits in module scope
- ✅ Impl blocks create scopes for methods
- ✅ Generic types (name in module scope, body creates scope for type params)
- ✅ Import/use resolution unchanged

### Results

**Before (Broken):**
```rust
// File: example.rs
struct MyStruct {
    // Scope: entire item (1:0 to 3:1)
    field: i32
}

// MyStruct.scope_id = "struct:example.rs:1:7:1:15" (struct's own scope ❌)
```

**After (Fixed):**
```rust
// File: example.rs
struct MyStruct {
    // Scope: body only (1:16 to 3:1, starts at '{')
    field: i32
}

// MyStruct.scope_id = "module:example.rs:1:1:4:0" (module scope ✅)
```

### Success Criteria

- ✅ Rust .scm updated with body-based captures
- ✅ Import resolver verified (no changes required)
- ✅ All import resolver tests passing
- ✅ Type names (structs, enums, traits) correctly assigned to module scope
- ✅ Impl blocks handled correctly (create scopes, don't export names)
- ✅ All struct variants handled correctly
- ✅ No regressions in semantic index tests

### Impact & Benefits

**Immediate Improvements:**
1. **Module Exports Fixed**: `pub struct MyStruct` now exports correctly
2. **Trait Resolution Fixed**: Trait names now findable in module scope
3. **Impl Resolution Fixed**: Impl block methods in correct scope
4. **Generic Types Work**: Type parameters correctly scoped
5. **All Struct Variants**: Automatic handling of regular/tuple/unit structs

**Test Results:**
- Rust semantic index tests: All passing ✅
- Import resolution tests: All passing ✅
- Struct variant tests: All passing ✅
- Completes body-based scope migration across all 4 languages

**Rust Module Examples:**
```rust
// Named struct
pub struct Point { x: i32, y: i32 }  // Point in module scope ✅

// Tuple struct
pub struct Point(i32, i32);  // Point in module scope, no body scope ✅

// Unit struct
pub struct Unit;  // Unit in module scope, no body scope ✅

// Enum
pub enum Option<T> { Some(T), None }  // Option in module scope ✅

// Trait
pub trait Display { fn fmt(&self); }  // Display in module scope ✅
```

### Rust-Specific Notes

**Multiple Construct Types:**
Rust has more scope-creating constructs than other languages:
- **Structs**: Field lists create scopes
- **Enums**: Variant lists create scopes
- **Traits**: Method signature lists create scopes
- **Impls**: Method implementation lists create scopes

All use body-based captures uniformly.

**Struct Variants:**
Rust has three struct forms, all handled correctly:
```rust
// Regular struct - has body → creates scope
struct Point { x: i32, y: i32 }
  // Point.scope_id = module_scope ✅
  // x.scope_id = struct_body_scope ✅

// Tuple struct - no field_declaration_list → no scope
struct Point(i32, i32);
  // Point.scope_id = module_scope ✅
  // Fields are parameters, not named fields

// Unit struct - no body → no scope
struct Unit;
  // Unit.scope_id = module_scope ✅
```

**Impl Blocks:**
Impl blocks create scopes but don't define types:
```rust
struct MyStruct { field: i32 }    // MyStruct in module scope ✅

impl MyStruct {                    // impl creates scope for methods ✅
    fn new() -> Self { }           // new() in impl scope ✅
    fn get(&self) -> i32 { }       // get() in impl scope ✅
}

// Usage:
MyStruct::new()  // Resolves MyStruct in module scope, new in impl scope
```

**Generic Types:**
Type parameters belong to type body scope:
```rust
struct Point<T> {                  // Point in module scope ✅
    x: T,                          // x in struct body scope, T from generic params ✅
    y: T,                          // y in struct body scope, T from generic params ✅
}
```

**Trait Items:**
Trait methods are in trait body scope:
```rust
trait Display {                    // Display in module scope ✅
    fn fmt(&self) -> String;       // fmt in trait body scope ✅
}
```

**Module Structure:**
```rust
mod utils {                        // utils is a module
    pub struct Helper { }          // Helper in utils module scope ✅

    impl Helper {                  // impl creates scope ✅
        pub fn new() -> Self { }   // new in impl scope ✅
    }
}

use utils::Helper;  // Resolves Helper in utils module scope ✅
```

### Comparison Across Languages

| Language | Constructs Updated | Body Node Types |
|----------|-------------------|----------------|
| TypeScript | classes, interfaces, enums | `class_body`, `object_type`, `enum_body` |
| JavaScript | classes only | `class_body` |
| Python | classes only | `block` (indentation) |
| **Rust** | **structs, enums, traits, impls** | **`field_declaration_list`, `enum_variant_list`, `declaration_list`** |

Rust required the most updates (4 constructs) but uses the same conceptual approach.

### Tree-sitter Node Types

**Rust's body node types explained:**
- `field_declaration_list`: Named struct fields `{ field: Type }`
- `enum_variant_list`: Enum variants `{ Variant1, Variant2 }`
- `declaration_list`: Trait signatures or impl methods `{ fn method(); }`

**Why separate node types:**
Rust's type system is richer than JavaScript/TypeScript:
- Structs have fields
- Enums have variants
- Traits have method signatures
- Impls have method implementations

Each construct has its own tree-sitter node type for its body.

### Related Work

- **Parent Task**: epic-11.112 (Scope System Consolidation)
- **Follows**:
  - task-epic-11.112.5 (TypeScript body-based scopes)
  - task-epic-11.112.6 (JavaScript body-based scopes)
  - task-epic-11.112.7 (Python body-based scopes)
- **Completes**: Body-based scope migration across all 4 languages
- **Enables**:
  - Trait resolution improvements
  - Impl block method resolution
  - Advanced Rust type features (associated types, trait bounds)
