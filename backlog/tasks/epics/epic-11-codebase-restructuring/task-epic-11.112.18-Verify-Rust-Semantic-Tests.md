# Task epic-11.112.18: Verify Rust Semantic Tests

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.12-13, 11.112.14

## Objective

Verify that Rust semantic index tests pass after scope assignment fixes for structs and enums. Update test expectations if needed to reflect correct scope_id values.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/semantic_index.rust.test.ts`

## Implementation Steps

### 1. Run Rust Semantic Tests (10 min)

```bash
npm test -- semantic_index.rust.test.ts
```

Expected: Some tests may fail if they have hardcoded expectations about scope_id values.

### 2. Analyze Test Failures (20 min)

For each failing test, determine:
- Does it expect incorrect scope_id for structs? (needs update)
- Does it expect incorrect scope_id for enums? (needs update)
- Does it involve impl blocks? (special case)
- Is it unrelated to scope assignment? (separate issue)

### 3. Update Struct Scope Expectations (30 min)

Update tests for structs:
```rust
// Test case:
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }
}
```

```typescript
it('should index Rust struct with correct scope', () => {
  const struct_def = find_class('Rectangle'); // Rust structs stored as classes
  expect(struct_def.scope_id).toBe(index.root_scope_id); // ← Verify correct
});
```

### 4. Update Enum Scope Expectations (30 min)

Update tests for enums:
```rust
// Test case:
enum Color {
    Red,
    Green,
    Blue,
}

fn process_color(color: Color) {
    match color {
        Color::Red => println!("Red"),
        _ => println!("Other"),
    }
}
```

```typescript
it('should index Rust enum with correct scope', () => {
  const enum_def = find_enum('Color');
  expect(enum_def.scope_id).toBe(index.root_scope_id); // ← Verify correct
});
```

### 5. Verify Tuple Struct Cases (15 min)

Rust tuple structs should also have correct scope:
```rust
// Test case:
struct Point(i32, i32);

impl Point {
    fn distance(&self) -> f64 {
        ((self.0 * self.0 + self.1 * self.1) as f64).sqrt()
    }
}
```

```typescript
it('should index tuple struct with correct scope', () => {
  const struct_def = find_class('Point');
  expect(struct_def.scope_id).toBe(index.root_scope_id);
});
```

### 6. Verify Complex Enum Cases (20 min)

Enums with variants containing data:
```rust
// Test case:
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
}

impl Message {
    fn call(&self) { }
}
```

```typescript
it('should index enum with variants with correct scope', () => {
  const enum_def = find_enum('Message');
  expect(enum_def.scope_id).toBe(index.root_scope_id);
});
```

### 7. Add Regression Tests (30 min)

Add explicit tests for the bug:
```typescript
describe('Rust Scope Assignment Regression Tests', () => {
  it('struct scope_id is not impl method scope_id', () => {
    const code = `
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn perimeter(&self) -> u32 {
        2 * (self.width + self.height)
    }
}`;
    const index = build_semantic_index(code, 'test.rs');
    const struct_def = Array.from(index.classes.values()).find(c => c.name === 'Rectangle');
    const method_scope = Array.from(index.scopes.values()).find(
      s => s.name === 'area' || s.name === 'perimeter'
    );

    expect(struct_def!.scope_id).not.toBe(method_scope?.id);
    expect(struct_def!.scope_id).toBe(index.root_scope_id);
  });

  it('enum scope_id is not match arm scope_id', () => {
    const code = `
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
}`;
    const index = build_semantic_index(code, 'test.rs');
    const enum_def = Array.from(index.enums.values())[0];
    const function_scope = Array.from(index.scopes.values()).find(
      s => s.name === 'process_color'
    );

    expect(enum_def.scope_id).not.toBe(function_scope?.id);
    expect(enum_def.scope_id).toBe(index.root_scope_id);
  });
});
```

### 8. Verify All Tests Pass (10 min)

```bash
npm test -- semantic_index.rust.test.ts
```

Expected: All tests pass.

## Success Criteria

- ✅ All Rust semantic tests pass
- ✅ Struct scope expectations updated
- ✅ Enum scope expectations updated
- ✅ Tuple struct cases handled
- ✅ Complex enum cases handled
- ✅ Regression tests added

## Outputs

- Updated `semantic_index.rust.test.ts` with correct expectations

## Next Task

**task-epic-11.112.19** - Verify TypeContext tests (critical success metric)
