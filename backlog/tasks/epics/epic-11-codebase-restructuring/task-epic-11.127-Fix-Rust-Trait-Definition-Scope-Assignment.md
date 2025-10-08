# Task: Fix Rust Trait Definition Scope Assignment

**Status**: To Do
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-08
**Priority**: Medium
**Severity**: Bug - Functional

## Problem

Rust trait definitions are being assigned to their own trait scope instead of the parent module scope. This causes trait name lookups to fail because the trait name is not accessible from the module scope where it should be defined.

### Discovered During
Task epic-11.126 - While fixing module scope end position off-by-one bug, the verify_scopes.test.ts revealed this separate issue.

### Failing Test
File: [verify_scopes.test.ts](../../../../packages/core/src/verify_scopes.test.ts)

```typescript
it("Rust: struct, enum, trait in module scope", () => {
  const code = `struct MyStruct {
    field: i32,
}

enum MyEnum {
    A, B, C
}

trait MyTrait {
    fn method(&self);
}`;

  // Test expects:
  expect(myTrait!.defining_scope_id).toBe(moduleScope!.id);

  // Actual result:
  // MyTrait.defining_scope_id = "class:test.rs:9:1:11:1"
  // moduleScope.id = "module:test.rs:1:1:11:1"

  // MyStruct ✅ correctly assigned to module scope
  // MyEnum ✅ correctly assigned to module scope
  // MyTrait ❌ incorrectly assigned to trait's own scope
});
```

### Scope Tree Analysis

The test debug output shows:
```javascript
All scopes: [
  { type: 'module', id: 'module:test.rs:1:1:11:1', parent_id: null },
  { type: 'class', id: 'class:test.rs:1:17:3:1', parent_id: 'module:test.rs:1:1:11:1' },      // MyStruct body
  { type: 'class', id: 'class:test.rs:5:13:7:1', parent_id: 'module:test.rs:1:1:11:1' },      // MyEnum body
  { type: 'class', id: 'class:test.rs:9:1:11:1', parent_id: 'module:test.rs:1:1:11:1' },      // MyTrait (WRONG!)
  { type: 'class', id: 'class:test.rs:9:15:11:1', parent_id: 'class:test.rs:9:1:11:1' }       // MyTrait body
]

✓ MyStruct: module:test.rs:1:1:11:1   (defining_scope_id = module scope ✅)
✓ MyEnum: module:test.rs:1:1:11:1     (defining_scope_id = module scope ✅)
✓ MyTrait: class:test.rs:9:1:11:1     (defining_scope_id = trait scope ❌)
```

### Issue Analysis

1. **Trait scope is created correctly** - The trait body creates a class scope at `class:test.rs:9:15:11:1`
2. **Trait name scope is wrong** - The trait name is being defined in scope `class:test.rs:9:1:11:1` instead of the module scope
3. **Struct and Enum work correctly** - Both are assigned to module scope as expected

### Root Cause Hypothesis

The issue is likely in how trait definitions are being processed:

**Expected behavior:**
```
trait MyTrait {           <- trait NAME defined in MODULE scope
    fn method(&self);     <- method defined in TRAIT scope
}
```

**Actual behavior:**
```
trait MyTrait {           <- trait NAME defined in TRAIT scope ❌
    fn method(&self);     <- method defined in TRAIT BODY scope
}
```

### Why This is Wrong

Trait definitions should follow the same pattern as struct and enum:
- The **name** of the trait should be accessible in the **parent scope** (module/parent function)
- The **body** of the trait defines a new scope for its methods
- This is analogous to how class names are in the parent scope, not the class body scope

### Impact

**Severity: Medium** - This prevents proper trait name resolution in Rust code:
- Trait names cannot be looked up from module scope
- Trait implementations (`impl Trait for Type`) cannot find the trait
- Method resolution that requires trait bounds will fail
- Affects any codebase using Rust traits (common pattern)

**Functional Impact:**
- Symbol resolution fails for trait names
- Call graph tracing cannot follow trait method calls
- Type checking for trait bounds is broken

## Files to Investigate

### Query Files
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm` - Trait capture queries

### Builder/Definition Files
Likely location of the bug - where trait definitions are created:
- Search for: `trait_item`, `@definition.trait`, trait processing logic
- Look for where trait **names** get their `defining_scope_id` assigned

### Reference Files
- `packages/core/src/verify_scopes.test.ts:199-273` - Failing test
- Any Rust-specific definition builders

## Investigation Steps

### 1. Find Trait Definition Processing

```bash
# Find where trait definitions are created
grep -r "trait_item\|@definition.trait" packages/core/src/index_single_file/
grep -r "defining_scope_id.*trait" packages/core/src/
```

### 2. Compare with Struct/Enum Processing

Look at how structs and enums are processed (they work correctly):
```typescript
// Struct processing (CORRECT):
// struct MyStruct { ... }
// MyStruct.defining_scope_id = module scope ✅

// Trait processing (BROKEN):
// trait MyTrait { ... }
// MyTrait.defining_scope_id = trait scope ❌
```

### 3. Check Scope Assignment Logic

The bug is likely in one of these places:
1. **Capture processing** - Trait captures may have wrong scope info
2. **Definition building** - Trait definitions may use wrong scope calculation
3. **Scope context** - `get_scope_id()` may return wrong scope for trait names

### 4. Verify Tree-sitter AST Structure

Check what tree-sitter returns for traits:
```bash
node -e "
const Parser = require('tree-sitter');
const Rust = require('tree-sitter-rust');

const code = \`trait MyTrait {
    fn method(&self);
}\`;

const parser = new Parser();
parser.setLanguage(Rust);
const tree = parser.parse(code);
console.log(tree.rootNode.toString());
"
```

Expected: `(trait_item name: (type_identifier) body: (declaration_list ...))`

## Solution Approaches

### Option 1: Fix Definition Scope Assignment (Most Likely)

If trait definitions are using the wrong scope when calculating `defining_scope_id`:

**Before (buggy):**
```typescript
// Using the trait's own scope
const trait_def: InterfaceDefinition = {
  name: trait_name,
  defining_scope_id: trait_scope_id,  // ❌ Wrong - this is the trait body scope
  ...
};
```

**After (fixed):**
```typescript
// Using the parent scope (like structs/enums do)
const trait_def: InterfaceDefinition = {
  name: trait_name,
  defining_scope_id: context.get_scope_id(trait_name_location),  // ✅ Correct
  ...
};
```

### Option 2: Fix Scope Context Calculation

If `get_scope_id()` returns wrong scope for trait name nodes:

```typescript
// Ensure trait NAME nodes are looked up at their START position,
// not within the trait body
const name_location = {
  ...
  // Use position of "MyTrait" keyword, not the body "{ ... }"
};
```

### Option 3: Fix Query Captures

If the rust.scm query is capturing trait names with wrong scope context:

```scheme
;; Before (if buggy):
(trait_item
  name: (type_identifier) @definition.trait)  ;; May capture entire trait scope

;; After (if needed):
(trait_item
  name: (type_identifier) @definition.trait.name)  ;; Capture only name
```

## Implementation Plan

### Phase 1: Investigation (30 min)

- [ ] Find where trait definitions are created in the codebase
- [ ] Compare trait processing with struct/enum processing (working examples)
- [ ] Verify tree-sitter AST structure for traits
- [ ] Identify exact location where `defining_scope_id` is set incorrectly

### Phase 2: Fix (30-60 min)

- [ ] Apply fix based on findings (likely Option 1 or 2)
- [ ] Ensure trait names use parent scope like structs/enums
- [ ] Maintain trait body scope for methods (should already work)
- [ ] Test with verify_scopes.test.ts

### Phase 3: Validation (30 min)

- [ ] Run verify_scopes.test.ts - all 4 tests should pass
- [ ] Run Rust-specific semantic index tests
- [ ] Verify no regressions in struct/enum/function scoping
- [ ] Test with realistic Rust code using traits

## Acceptance Criteria

- [ ] MyTrait definition has `defining_scope_id` = module scope
- [ ] Trait body scope still exists for trait methods
- [ ] verify_scopes.test.ts Rust test passes completely
- [ ] No regressions in struct/enum scoping
- [ ] Trait methods can still be resolved within trait scope
- [ ] Trait implementations (`impl Trait for Type`) can find trait names

## Testing Strategy

### Test 1: Basic Trait Scoping
```rust
trait MyTrait {
    fn method(&self);
}

// Expected:
// - MyTrait.defining_scope_id = module scope
// - method.defining_scope_id = trait scope
```

### Test 2: Trait with Multiple Methods
```rust
trait Complex {
    fn method1(&self) -> i32;
    fn method2(&mut self, x: i32);
}

// All methods should be in trait scope
// Trait name should be in module scope
```

### Test 3: Nested Module with Trait
```rust
mod utils {
    pub trait Helper {
        fn help(&self);
    }
}

// Expected:
// - Helper.defining_scope_id = utils module scope
// - help.defining_scope_id = Helper trait scope
```

### Test 4: Trait Implementation
```rust
trait Drawable {
    fn draw(&self);
}

struct Circle;

impl Drawable for Circle {
    fn draw(&self) {
        // ...
    }
}

// Expected:
// - Drawable trait can be resolved from module scope
// - impl block can find Drawable trait
```

## Related Issues

- **Parent**: task-epic-11.126 - Discovered during module scope position fix
- **Related**: task-epic-11.123 - Implement Rust Method Resolution Metadata (may be affected)

## Success Metrics

**Before:**
- verify_scopes.test.ts: 1 of 4 Rust assertions failing
- Trait names cannot be resolved from module scope
- Trait-based method resolution broken

**After:**
- verify_scopes.test.ts: All 4 Rust assertions passing
- Trait names properly accessible from parent scope
- Trait-based method resolution working
- No regressions in struct/enum/function scoping

## Notes

- This is a **functional bug**, not a cosmetic issue like task-11.126
- The position fix (11.126) is working correctly - this is a scope assignment bug
- Structs and enums provide working examples of correct behavior
- Trait body scopes are created correctly; only the name assignment is wrong
- This likely affects all Rust code using traits in the codebase

## Estimated Effort

- Investigation: 30 minutes
- Implementation: 30-60 minutes
- Testing: 30 minutes
- **Total**: 1.5-2 hours

## Priority Justification

**Medium Priority** because:
- Affects functional correctness (not just cosmetic)
- Breaks trait-based method resolution in Rust
- Impacts any codebase analysis of Rust projects
- Relatively quick fix (struct/enum show the pattern)

**Not High Priority** because:
- Only affects Rust language support
- Has clear workaround (use structs/enums pattern)
- Does not block other epic-11 work
