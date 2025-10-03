# Task epic-11.112.12: Fix Rust Struct Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.11

## Objective

Update Rust struct definitions to use `get_defining_scope_id()` to fix scope assignment bug. Structs in Rust are similar to classes in other languages.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_config.ts`

## Implementation Steps

### 1. Locate Struct Definition Handler (10 min)

Find the handler for `@definition.class` or struct-specific handler:

```typescript
{
  name: "definition.class",  // or "definition.struct"
  handler: (capture, context, builder) => {
    const struct_id = class_symbol(/* ... */);

    builder.add_class({
      symbol_id: struct_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      availability: determine_availability(capture.node),
      // Rust-specific fields...
    });
  }
}
```

### 2. Apply Fix (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Check Impl Block Scope Assignment (15 min)

Rust has `impl` blocks that might also need fixing:
```rust
struct Point {
    x: i32,
    y: i32,
}

impl Point {
    fn new() -> Self { }
}
```

Check if impl blocks have scope assignment issues.

### 4. Verify All Struct Handlers (10 min)

```bash
grep -n "add_class\|struct" packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_config.ts
```

### 5. Run Rust Semantic Tests (15 min)

```bash
npm test -- semantic_index.rust.test.ts
```

### 6. Manual Verification (30 min)

Test with Rust structs:
```rust
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }
}

fn main() {
    let rect = Rectangle { width: 10, height: 20 };
}
```

Verify:
- `Rectangle.scope_id === file_scope` ✓
- Not pointing to method scope ❌

## Success Criteria

- ✅ Rust struct definitions use `get_defining_scope_id()`
- ✅ Impl blocks handled correctly
- ✅ Tests pass
- ✅ Manual verification confirms fix

## Outputs

- Fixed Rust struct scope assignment

## Next Task

**task-epic-11.112.13** - Fix Rust enum scopes
