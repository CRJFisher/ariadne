# Task epic-11.112.13: Fix Rust Enum Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.12

## Objective

Update Rust enum definitions to use `get_defining_scope_id()` to fix scope assignment bug. Enums in Rust are similar to enums in other languages but can also contain variant data.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_config.ts`

## Implementation Steps

### 1. Locate Enum Definition Handler (10 min)

Find the handler for `@definition.enum` or similar:

```typescript
{
  name: "definition.enum",
  handler: (capture, context, builder) => {
    const enum_id = type_symbol(/* ... */);

    builder.add_enum({
      symbol_id: enum_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      availability: determine_availability(capture.node),
      variants: extract_variants(capture.node),
    });
  }
}
```

### 2. Apply Fix (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Check Enum Variants (10 min)

Rust enums can have complex variants:
```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}

impl Message {
    fn call(&self) {
        // implementation
    }
}
```

Verify variants don't have scope issues.

### 4. Verify All Enum Handlers (10 min)

```bash
grep -n "add_enum\|enum_symbol" packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_config.ts
```

### 5. Run Rust Semantic Tests (10 min)

```bash
npm test -- semantic_index.rust.test.ts
```

### 6. Manual Verification (15 min)

Test with Rust enum:
```rust
enum Color {
    Red,
    Green,
    Blue,
}

fn process_color(color: Color) {
    match color {
        Color::Red => println!("Red"),
        Color::Green => println!("Green"),
        Color::Blue => println!("Blue"),
    }
}
```

Verify:
- `Color.scope_id === file_scope` ✓
- Not pointing to process_color method scope ❌

## Success Criteria

- ✅ Rust enum definitions use `get_defining_scope_id()`
- ✅ Enum variants handled correctly
- ✅ Tests pass
- ✅ Manual verification confirms fix

## Outputs

- Fixed Rust enum scope assignment

## Next Task

**task-epic-11.112.14** - Create comprehensive scope assignment test suite
