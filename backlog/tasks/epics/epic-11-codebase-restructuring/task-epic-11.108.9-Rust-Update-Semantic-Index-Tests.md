# Task 11.108.9: Rust - Update Semantic Index Tests

**Status:** Not Started
**Priority:** **CRITICAL**
**Estimated Effort:** 4-5 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.5 (Rust processing complete)

## Objective

**CRITICAL:** Create comprehensive tests for Rust semantic index that verify the newly-added parameter and import tracking, plus all existing features.

## Why Critical

Rust currently has NO parameter or import tracking. This task verifies those critical features work after implementation. Without these tests, we can't be sure the fixes in 11.108.5 actually work.

## Coverage Required

### Core Features
- [ ] Structs (classes)
- [ ] Struct fields
- [ ] **Functions with parameters** (CRITICAL - was broken)
- [ ] **Methods with parameters** (CRITICAL - was broken)
- [ ] impl blocks
- [ ] **Constructors (new methods)** (needs fix)
- [ ] **Trait definitions** (interfaces)
- [ ] **Trait method signatures** (needs fix)
- [ ] **Trait method parameters** (CRITICAL)
- [ ] Enums
- [ ] Enum variants
- [ ] Type aliases
- [ ] **Use statements** (CRITICAL - was missing)
- [ ] **Extern crate** (CRITICAL - was missing)
- [ ] Modules/namespaces

### Rust-Specific Features
- [ ] Generic parameters
- [ ] Lifetime parameters
- [ ] Self parameters (&self, &mut self, self)
- [ ] Associated functions (static methods)
- [ ] Visibility modifiers (pub, pub(crate), etc.)
- [ ] Async functions
- [ ] Unsafe functions

## Critical New Tests

### Function Parameters (CRITICAL)
```typescript
it("CRITICAL: extracts function parameters", () => {
  const code = `
fn add(x: i32, y: i32) -> i32 {
    x + y
}

fn greet(name: &str, times: usize) {
    for _ in 0..times {
        println!("Hello, {}", name);
    }
}
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const add_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "add"
  );

  // THIS WAS COMPLETELY BROKEN - parameters were never tracked!
  expect(add_func).toBeDefined();
  expect(add_func?.parameters).toBeDefined();
  expect(add_func?.parameters).toHaveLength(2);
  expect(add_func?.parameters[0]).toEqual({
    symbol_id: expect.any(String),
    name: "x",
    location: expect.objectContaining({ file_path: "test.rs" }),
    scope_id: expect.any(String),
    type: "i32",
  });
  expect(add_func?.parameters[1]).toEqual({
    symbol_id: expect.any(String),
    name: "y",
    location: expect.objectContaining({ file_path: "test.rs" }),
    scope_id: expect.any(String),
    type: "i32",
  });

  const greet_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "greet"
  );
  expect(greet_func?.parameters).toHaveLength(2);
  expect(greet_func?.parameters[0].type).toBe("&str");
  expect(greet_func?.parameters[1].type).toBe("usize");
});
```

### Method Parameters with Self (CRITICAL)
```typescript
it("CRITICAL: extracts method parameters including self", () => {
  const code = `
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn new(width: u32, height: u32) -> Self {
        Rectangle { width, height }
    }

    fn area(&self) -> u32 {
        self.width * self.height
    }

    fn scale(&mut self, factor: u32) {
        self.width *= factor;
        self.height *= factor;
    }

    fn from_square(size: u32) -> Self {
        Rectangle::new(size, size)
    }
}
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const struct_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "Rectangle"
  );

  expect(struct_def).toBeDefined();

  // Constructor
  const new_method = Array.from(struct_def?.methods?.values() || []).find(
    (m) => m.name === "constructor" || m.name === "new"
  );
  expect(new_method).toBeDefined();
  expect(new_method?.parameters).toHaveLength(2); // width, height (not Self)
  expect(new_method?.static).toBe(true);

  // Instance method with &self
  const area_method = Array.from(struct_def?.methods?.values() || []).find(
    (m) => m.name === "area"
  );
  expect(area_method?.parameters).toHaveLength(1); // &self
  expect(area_method?.parameters[0].name).toBe("self");

  // Mutable self method
  const scale_method = Array.from(struct_def?.methods?.values() || []).find(
    (m) => m.name === "scale"
  );
  expect(scale_method?.parameters).toHaveLength(2); // &mut self, factor
  expect(scale_method?.parameters[0].name).toBe("self");
  expect(scale_method?.parameters[1].name).toBe("factor");
  expect(scale_method?.parameters[1].type).toBe("u32");

  // Associated function (static)
  const from_square = Array.from(struct_def?.methods?.values() || []).find(
    (m) => m.name === "from_square"
  );
  expect(from_square?.static).toBe(true);
  expect(from_square?.parameters).toHaveLength(1); // size
  expect(from_square?.parameters[0].name).toBe("size");
});
```

### Use Statements (CRITICAL - was completely missing)
```typescript
it("CRITICAL: extracts use statements", () => {
  const code = `
use std::collections::HashMap;
use std::io::{Read, Write};
use std::fmt::*;
use crate::models::User;
extern crate serde;
extern crate serde_json as json;
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const imports = Array.from(result.definitions.values()).filter(
    (d) => d.kind === "import"
  );

  // THIS WAS COMPLETELY MISSING!
  expect(imports.length).toBeGreaterThanOrEqual(4);

  const hashmap_import = imports.find((i) => i.name === "HashMap");
  expect(hashmap_import).toBeDefined();
  expect(hashmap_import?.import_path).toBe("std::collections::HashMap");
  expect(hashmap_import?.import_kind).toBe("named");

  const read_import = imports.find((i) => i.name === "Read");
  expect(read_import?.import_path).toContain("std::io");

  const glob_import = imports.find((i) => i.name === "*");
  expect(glob_import?.import_kind).toBe("namespace");

  const serde_import = imports.find((i) => i.name === "serde");
  expect(serde_import?.import_kind).toBe("namespace");

  const json_import = imports.find((i) => i.name === "json");
  expect(json_import?.original_name).toBe("serde_json");
});
```

### Trait Method Signatures (needs fix)
```typescript
it("extracts trait definitions with method signatures", () => {
  const code = `
trait Drawable {
    fn draw(&self, canvas: &Canvas);
    fn color(&self) -> Color;
    fn resize(&mut self, width: u32, height: u32);
}

trait Default {
    fn default() -> Self;
}
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const drawable_trait = Array.from(result.definitions.values()).find(
    (d) => d.kind === "interface" && d.name === "Drawable"
  );

  expect(drawable_trait).toBeDefined();
  expect(drawable_trait?.methods?.size).toBe(3);

  const draw_method = Array.from(drawable_trait?.methods?.values() || []).find(
    (m) => m.name === "draw"
  );
  expect(draw_method).toBeDefined();
  expect(draw_method?.parameters).toHaveLength(2); // &self, canvas
  expect(draw_method?.parameters[0].name).toBe("self");
  expect(draw_method?.parameters[1].name).toBe("canvas");
  expect(draw_method?.parameters[1].type).toBe("&Canvas");

  const color_method = Array.from(drawable_trait?.methods?.values() || []).find(
    (m) => m.name === "color"
  );
  expect(color_method?.return_type).toBe("Color");

  const default_trait = Array.from(result.definitions.values()).find(
    (d) => d.kind === "interface" && d.name === "Default"
  );
  const default_method = Array.from(default_trait?.methods?.values() || []).find(
    (m) => m.name === "default"
  );
  expect(default_method?.parameters).toHaveLength(0); // No self - associated function
});
```

### Generics
```typescript
it("extracts generic parameters", () => {
  const code = `
struct Container<T> {
    value: T,
}

impl<T> Container<T> {
    fn new(value: T) -> Self {
        Container { value }
    }

    fn get(&self) -> &T {
        &self.value
    }
}

fn identity<T>(x: T) -> T {
    x
}
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const struct_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "Container"
  );

  expect(struct_def?.type_parameters).toEqual(["T"]);

  const identity_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "identity"
  );
  expect(identity_func?.parameters).toHaveLength(1);
  expect(identity_func?.parameters[0].name).toBe("x");
  expect(identity_func?.parameters[0].type).toBe("T");
});
```

## File to Update

**File:** `packages/core/src/index_single_file/semantic_index.rust.test.ts`

## Verification Priority

1. **CRITICAL:** Function parameters work
2. **CRITICAL:** Method parameters work
3. **CRITICAL:** Use statements tracked
4. Constructor uses dedicated API
5. Trait methods added to interfaces
6. All other features work

## Success Criteria

- ✅ **CRITICAL:** Function parameters test passes
- ✅ **CRITICAL:** Method parameters test passes
- ✅ **CRITICAL:** Use statement test passes
- ✅ Trait method signatures test passes
- ✅ Constructor test passes
- ✅ All tests use complete object assertions
- ✅ No regressions in existing features
- ✅ All tests pass

## Notes

**This is the most important test task.** Rust had NO parameter or import tracking before 11.108.5. These tests verify those critical features now work. If these tests don't pass, Rust semantic indexing is essentially useless.
