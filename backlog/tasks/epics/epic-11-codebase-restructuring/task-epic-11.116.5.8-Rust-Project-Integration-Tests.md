# Task epic-11.116.5.8: Rust Project Integration Tests

**Status:** Not Started
**Parent:** task-epic-11.116.5
**Depends On:** task-epic-11.116.5.4, task-epic-11.116.5.5
**Priority:** High
**Created:** 2025-10-16

## Overview

Create integration tests for the `Project` class using Rust fixtures. Tests Rust-specific patterns including impl blocks, traits, associated functions, ownership system, and Rust's module system.

## Rust-Specific Considerations

### Key Differences from Other Languages

1. **Impl Blocks** - Methods defined separately from struct
2. **Associated Functions** - Called with `::` not `.`
3. **Traits** - Rust's interface system
4. **Module System** - `mod`, `use`, `pub`, hierarchical
5. **Ownership** - May affect reference tracking
6. **Self vs self** - Type vs instance
7. **Pattern Matching** - Comprehensive destructuring

### Critical Rust Patterns 

```rust
// Struct definition (no methods)
struct User {
    name: String,
}

// Impl block (methods defined separately)
impl User {
    // Associated function (::new)
    pub fn new(name: String) -> Self {
        User { name }
    }

    // Method (&self)
    pub fn get_name(&self) -> &str {
        &self.name
    }
}

// Trait definition
trait Displayable {
    fn display(&self) -> String;
}

// Trait implementation
impl Displayable for User {
    fn display(&self) -> String {
        self.name.clone()
    }
}
```

## Test File Structure

Create: `packages/core/src/project/project.rust.integration.test.ts`

## Test Categories

### 1. Impl Blocks (CRITICAL)

```typescript
describe("Project Integration - Rust", () => {
  describe("Impl Blocks", () => {
    it("should link struct to its impl block methods", async () => {
      const project = new Project();
      await project.initialize();

      const source = load_source("structs/user_with_impl.rs");
      project.update_file("user_with_impl.rs" as FilePath, source);

      const index = project.get_semantic_index("user_with_impl.rs" as FilePath);

      // Find struct
      const structs = Array.from(index.classes.values()); // Structs map to classes
      expect(structs.length).toBeGreaterThan(0);

      // Get type members (should include impl block methods)
      const type_members = project.types.get_type_members(structs[0].symbol_id);
      expect(type_members).toBeDefined();
      expect(type_members?.methods.size).toBeGreaterThan(0);

      // Verify method is from impl block, not struct itself
      const get_name = type_members?.methods.get("get_name" as SymbolName);
      expect(get_name).toBeDefined();
    });

    it("should resolve associated function calls (::new)", async () => {
      const project = new Project();
      await project.initialize();

      const source = load_source("structs/user_with_impl.rs");
      project.update_file("user_with_impl.rs" as FilePath, source);

      const index = project.get_semantic_index("user_with_impl.rs" as FilePath);

      // Find User::new() call
      const calls = index.references.filter(
        r => r.type === "call" && r.name === ("new" as SymbolName)
      );
      expect(calls.length).toBeGreaterThan(0);

      // Verify resolves to associated function
      const resolved = project.resolutions.resolve(
        calls[0].scope_id,
        calls[0].name
      );
      expect(resolved).toBeDefined();

      const def = project.definitions.get(resolved!);
      expect(def?.kind).toBe("function"); // Associated functions are functions
    });

    it("should resolve method calls (&self)", async () => {
      const project = new Project();
      await project.initialize();

      const source = load_source("structs/user_with_impl.rs");
      project.update_file("user_with_impl.rs" as FilePath, source);

      const index = project.get_semantic_index("user_with_impl.rs" as FilePath);

      // Find user.get_name() call
      const method_call = index.references.find(
        r => r.type === "call" && r.call_type === "method"
      );
      expect(method_call).toBeDefined();

      // Verify resolves to method in impl block
      const resolved = project.resolutions.resolve(
        method_call!.scope_id,
        method_call!.name
      );
      expect(resolved).toBeDefined();
    });
  });
});
```

### 2. Module System

```typescript
describe("Module System", () => {
  it("should resolve 'use' imports", async () => {
    const project = new Project();
    await project.initialize();

    const utils = load_source("modules/utils.rs");
    const main = load_source("modules/main.rs");

    project.update_file("utils.rs" as FilePath, utils);
    project.update_file("main.rs" as FilePath, main);

    // Verify use statement creates import
    const main_index = project.get_semantic_index("main.rs" as FilePath);
    const imports = Array.from(main_index.imported_symbols.values());
    expect(imports.length).toBeGreaterThan(0);

    // Verify call resolves across modules
    const call = main_index.references.find(r => r.type === "call");
    const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
    expect(resolved).toBeDefined();
  });

  it("should handle mod declarations", async () => {
    // Test: mod utils; use utils::helper;
  });

  it("should handle pub visibility", async () => {
    // Verify pub items are exported
  });

  it("should handle nested modules", async () => {
    // Test: mod foo { pub mod bar { pub fn baz() {} } }
  });
});
```

### 3. Traits

```typescript
describe("Traits", () => {
  it("should capture trait definitions", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("traits/displayable.rs");
    project.update_file("displayable.rs" as FilePath, source);

    const index = project.get_semantic_index("displayable.rs" as FilePath);

    // Find trait definition (may be in interfaces map)
    const traits = Array.from(index.interfaces.values());
    expect(traits.length).toBeGreaterThan(0);
  });

  it("should link trait impl to struct", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("traits/displayable.rs");
    project.update_file("displayable.rs" as FilePath, source);

    const index = project.get_semantic_index("displayable.rs" as FilePath);

    // Find impl Trait for Type
    // This should add trait methods to type members
    const structs = Array.from(index.classes.values());
    const type_members = project.types.get_type_members(structs[0].symbol_id);

    // Verify trait method is available on struct
    const display = type_members?.methods.get("display" as SymbolName);
    expect(display).toBeDefined();
  });

  it("should resolve trait method calls", async () => {
    // Test calling a method defined in a trait impl
  });
});
```

### 4. Cross-Module Structs and Impls

```typescript
describe("Cross-Module Resolution", () => {
  it("should resolve methods on imported structs", async () => {
    const project = new Project();
    await project.initialize();

    const user_mod = load_source("modules/user_mod.rs");
    const uses_user = load_source("modules/uses_user.rs");

    project.update_file("user_mod.rs" as FilePath, user_mod);
    project.update_file("uses_user.rs" as FilePath, uses_user);

    const main_index = project.get_semantic_index("uses_user.rs" as FilePath);

    // Find User::new() call
    const new_call = main_index.references.find(
      r => r.type === "call" && r.name === ("new" as SymbolName)
    );
    expect(new_call).toBeDefined();

    // Find method call
    const method_call = main_index.references.find(
      r => r.type === "call" && r.call_type === "method"
    );
    expect(method_call).toBeDefined();

    // Verify both resolve to definitions in user_mod.rs
    const new_resolved = project.resolutions.resolve(
      new_call!.scope_id,
      new_call!.name
    );
    const method_resolved = project.resolutions.resolve(
      method_call!.scope_id,
      method_call!.name
    );

    expect(new_resolved).toBeDefined();
    expect(method_resolved).toBeDefined();
  });
});
```

### 5. Rust-Specific Patterns

```typescript
describe("Rust Patterns", () => {
  it("should handle pattern matching", async () => {
    // Test: match expr { Pattern => ... }
  });

  it("should handle Result/Option patterns", async () => {
    // Test: if let Some(x) = opt { ... }
  });

  it("should handle ownership transfers", async () => {
    // May affect reference tracking (move semantics)
  });

  it("should handle borrowing (&, &mut)", async () => {
    // Verify &self, &mut self in method signatures
  });

  it("should handle lifetimes", async () => {
    // Test: fn foo<'a>(x: &'a str) -> &'a str
  });

  it("should handle generics", async () => {
    // Test: struct Foo<T> { ... }
    // Test: impl<T> Foo<T> { ... }
  });
});
```

### 6. Builder Pattern

```typescript
describe("Builder Pattern", () => {
  it("should resolve method chains in builder pattern", async () => {
    const project = new Project();
    await project.initialize();

    const source = load_source("structs/constructor_workflow.rs");
    project.update_file("builder.rs" as FilePath, source);

    const index = project.get_semantic_index("builder.rs" as FilePath);

    // Find method chain: Builder::new().add(5).multiply(2).build()
    const method_calls = index.references.filter(
      r => r.type === "call" && r.call_type === "method"
    );

    expect(method_calls.length).toBeGreaterThan(1);

    // Verify each method resolves
    for (const call of method_calls) {
      const resolved = project.resolutions.resolve(call.scope_id, call.name);
      expect(resolved).toBeDefined();
    }
  });
});
```

### 7. Shadowing

```typescript
describe("Shadowing", () => {
  it("should resolve to local definition when it shadows import", async () => {
    const project = new Project();
    await project.initialize();

    const utils = load_source("modules/utils.rs");
    const shadowing = load_source("modules/shadowing.rs");

    project.update_file("utils.rs" as FilePath, utils);
    project.update_file("shadowing.rs" as FilePath, shadowing);

    const main_index = project.get_semantic_index("shadowing.rs" as FilePath);

    // Find call to shadowed function
    const call = main_index.references.find(
      r => r.type === "call" && r.name === ("helper" as SymbolName)
    );

    const resolved = project.resolutions.resolve(call!.scope_id, call!.name);
    const def = project.definitions.get(resolved!);

    // Should resolve to local definition
    expect(def?.location.file_path).toContain("shadowing.rs");
  });
});
```

## Test Coverage Requirements

### Must Cover (Rust-Specific)

- [ ] Impl blocks linking to structs
- [ ] Associated functions (::new)
- [ ] Instance methods (&self, &mut self)
- [ ] Trait definitions
- [ ] Trait implementations (impl Trait for Type)
- [ ] Module system (mod, use, pub)
- [ ] Cross-module struct usage
- [ ] Shadowing

### Advanced Patterns

- [ ] Generic structs and impls
- [ ] Lifetime annotations
- [ ] Pattern matching
- [ ] Result/Option handling
- [ ] Builder pattern (method chaining)
- [ ] Nested modules

## Fixtures Required

Based on task 11.116.5.4, these fixtures should exist:

```
rust/code/
├── structs/
│   ├── basic_struct.rs
│   ├── user_with_impl.rs
│   └── constructor_workflow.rs
├── traits/
│   └── displayable.rs
├── modules/
│   ├── utils.rs
│   ├── main.rs
│   ├── user_mod.rs
│   ├── uses_user.rs
│   ├── shadowing.rs
│   └── inline_modules.rs
└── functions/
    ├── basic_functions.rs
    ├── nested_scopes.rs
    └── variable_shadowing.rs
```

## Success Criteria

- [ ] Impl blocks correctly link to structs
- [ ] Associated functions resolve (::)
- [ ] Methods resolve (.)
- [ ] Traits and trait impls work
- [ ] Module system resolves correctly
- [ ] Cross-module resolution works
- [ ] Shadowing works
- [ ] Tests use real `Project` class
- [ ] Tests load actual .rs source files

## Key Challenges

1. **Impl blocks separate from structs** - Type members must be built from impl blocks
2. **Associated functions vs methods** - Different call syntax (:: vs .)
3. **Traits add methods** - Must aggregate methods from multiple impl blocks
4. **Module system complexity** - Hierarchical, with pub visibility
5. **Ownership semantics** - May affect reference tracking

## Implementation Template

```typescript
import { describe, it, expect } from "vitest";
import { Project } from "./project";
import path from "path";
import fs from "fs";
import type { FilePath, SymbolName } from "@ariadnejs/types";

const FIXTURE_ROOT = path.join(
  __dirname,
  "../tests/fixtures/rust/code"
);

function load_source(relative_path: string): string {
  return fs.readFileSync(
    path.join(FIXTURE_ROOT, relative_path),
    "utf-8"
  );
}

describe("Project Integration - Rust", () => {
  // Tests here
});
```

## Estimated Effort

**4-5 hours** (Rust is most complex)
- 1.5 hours: Impl blocks and associated functions
- 1 hour: Module system
- 1 hour: Traits and trait impls
- 1 hour: Cross-module resolution
- 30 min: Rust-specific patterns

## Notes

- Rust is the most complex language due to impl blocks and traits
- **Impl blocks are CRITICAL** - Most Rust code uses them
- Associated functions (::) are different from methods (.)
- Traits can add methods to types retroactively
- Module system is hierarchical, unlike flat imports in JS/TS/Python
- Ownership may affect how references are tracked
- Focus on common patterns first (structs, impls, basic traits)
