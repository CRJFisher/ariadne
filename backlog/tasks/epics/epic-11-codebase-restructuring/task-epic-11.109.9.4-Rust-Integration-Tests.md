# Task 11.109.9.4: Rust Integration Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 days
**Parent:** task-epic-11.109.9
**Dependencies:** task-epic-11.109.8 (Main orchestration)

## Objective

Create comprehensive integration tests for Rust that validate symbol resolution with Rust-specific features: `use` statements, module hierarchy, trait implementations, associated functions, and Rust module resolution (`mod.rs`, `crate::`, `super::`).

## File to Create

**Single test file:**
- `packages/core/src/resolve_references/symbol_resolution.rust.test.ts`

## Implementation

### Test Structure

```typescript
/**
 * Rust Integration Tests
 *
 * Tests Rust-specific features: use statements, module hierarchy,
 * traits, impl blocks, and Rust module resolution
 */

import { resolve_symbols } from "./symbol_resolution";
import { create_semantic_index_from_code } from "../test_helpers/index_builder";
import type { SemanticIndex, FilePath } from "@ariadnejs/types";

describe("Rust Symbol Resolution Integration", () => {
  describe("Function Calls", () => {
    it("resolves local function call", () => {
      // Test implementation
    });

    it("resolves imported function call (use statement)", () => {
      // Test implementation
    });

    it("resolves fully qualified function call", () => {
      // Test implementation
    });
  });

  describe("Use Statements", () => {
    it("resolves crate:: absolute path", () => {
      // Test implementation
    });

    it("resolves super:: relative path", () => {
      // Test implementation
    });

    it("resolves self:: current module", () => {
      // Test implementation
    });
  });

  describe("Method Calls", () => {
    it("resolves method call on struct", () => {
      // Test implementation
    });

    it("resolves method from trait implementation", () => {
      // Test implementation
    });

    it("resolves associated function (::new)", () => {
      // Test implementation
    });
  });

  describe("Module Resolution", () => {
    it("resolves module file (utils.rs)", () => {
      // Test implementation
    });

    it("resolves module directory (utils/mod.rs)", () => {
      // Test implementation
    });

    it("resolves nested modules", () => {
      // Test implementation
    });
  });

  describe("Trait System", () => {
    it("resolves trait method call", () => {
      // Test implementation
    });

    it("resolves default trait implementation", () => {
      // Test implementation
    });
  });

  describe("Complex Scenarios", () => {
    it("resolves full workflow: use → construct → method call", () => {
      // Test implementation
    });

    it("resolves method call through trait bounds", () => {
      // Test implementation
    });
  });
});
```

## Key Test Scenarios

### 1. Basic Function Call with use

**Code:**
```rust
// utils.rs
pub fn helper() -> i32 {
    42
}

// main.rs
use crate::utils::helper;

fn main() {
    let result = helper();  // Should resolve to utils::helper
}
```

**Test:**
```typescript
it("resolves imported function call (use statement)", () => {
  const utils_code = `
pub fn helper() -> i32 {
    42
}
  `;

  const main_code = `
use crate::utils::helper;

fn main() {
    let result = helper();
}
  `;

  const utils_index = create_semantic_index_from_code(utils_code, "utils.rs", "rust");
  const main_index = create_semantic_index_from_code(main_code, "main.rs", "rust");

  const indices = new Map([
    ["utils.rs", utils_index],
    ["main.rs", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  const helper_call = find_reference_by_name(main_index, "helper", "function");
  const helper_def = find_definition(utils_index, "helper", "function");

  expect(resolved.resolved_references.get(location_key(helper_call.location)))
    .toBe(helper_def.symbol_id);
});
```

### 2. Super:: Relative Import

**Code:**
```rust
// models/user.rs
pub struct User {
    pub name: String,
}

// services/user_service.rs
use super::models::user::User;

pub struct UserService;

impl UserService {
    pub fn create_user(name: String) -> User {
        User { name }  // Should resolve to models::user::User
    }
}
```

**Test:**
```typescript
it("resolves super:: relative path", () => {
  const user_code = `
pub struct User {
    pub name: String,
}
  `;

  const service_code = `
use super::models::user::User;

pub struct UserService;

impl UserService {
    pub fn create_user(name: String) -> User {
        User { name: name }
    }
}
  `;

  const user_index = create_semantic_index_from_code(user_code, "models/user.rs", "rust");
  const service_index = create_semantic_index_from_code(service_code, "services/user_service.rs", "rust");

  const indices = new Map([
    ["models/user.rs", user_index],
    ["services/user_service.rs", service_index]
  ]);

  const resolved = resolve_symbols(indices);

  const User_call = find_reference_by_name(service_index, "User", "constructor");
  const User_struct = find_definition(user_index, "User", "struct");

  expect(resolved.resolved_references.get(location_key(User_call.location)))
    .toBe(User_struct.symbol_id);
});
```

### 3. Method Call on Struct

**Code:**
```rust
// user.rs
pub struct User {
    name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }

    pub fn get_name(&self) -> &str {
        &self.name
    }
}

// main.rs
use crate::user::User;

fn main() {
    let user = User::new(String::from("Alice"));  // Associated function
    let name = user.get_name();                    // Method call
}
```

**Test:**
```typescript
it("resolves associated function and method call", () => {
  const user_code = `
pub struct User {
    name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }

    pub fn get_name(&self) -> &str {
        &self.name
    }
}
  `;

  const main_code = `
use crate::user::User;

fn main() {
    let user = User::new(String::from("Alice"));
    let name = user.get_name();
}
  `;

  const user_index = create_semantic_index_from_code(user_code, "user.rs", "rust");
  const main_index = create_semantic_index_from_code(main_code, "main.rs", "rust");

  const indices = new Map([
    ["user.rs", user_index],
    ["main.rs", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Associated function call (User::new)
  const new_call = find_reference_by_name(main_index, "new", "function");
  const new_fn = find_impl_method(user_index, "User", "new");
  expect(resolved.resolved_references.get(location_key(new_call.location)))
    .toBe(new_fn.symbol_id);

  // Method call (user.get_name())
  const get_name_call = find_reference_by_name(main_index, "get_name", "method");
  const get_name_method = find_impl_method(user_index, "User", "get_name");
  expect(resolved.resolved_references.get(location_key(get_name_call.location)))
    .toBe(get_name_method.symbol_id);
});
```

### 4. Module Directory (mod.rs)

**Code:**
```rust
// utils/mod.rs
pub fn helper() -> i32 {
    42
}

// main.rs
use crate::utils::helper;

fn main() {
    helper();  // Should resolve to utils/mod.rs::helper
}
```

**Test:**
```typescript
it("resolves module directory (utils/mod.rs)", () => {
  const utils_code = `
pub fn helper() -> i32 {
    42
}
  `;

  const main_code = `
use crate::utils::helper;

fn main() {
    helper();
}
  `;

  const utils_index = create_semantic_index_from_code(utils_code, "utils/mod.rs", "rust");
  const main_index = create_semantic_index_from_code(main_code, "main.rs", "rust");

  const indices = new Map([
    ["utils/mod.rs", utils_index],
    ["main.rs", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  const helper_call = find_reference_by_name(main_index, "helper", "function");
  const helper_def = find_definition(utils_index, "helper", "function");

  expect(resolved.resolved_references.get(location_key(helper_call.location)))
    .toBe(helper_def.symbol_id);
});
```

### 5. Trait Implementation

**Code:**
```rust
// traits.rs
pub trait Display {
    fn display(&self) -> String;
}

// user.rs
use crate::traits::Display;

pub struct User {
    name: String,
}

impl Display for User {
    fn display(&self) -> String {
        self.name.clone()
    }
}

// main.rs
use crate::user::User;
use crate::traits::Display;

fn main() {
    let user = User { name: String::from("Alice") };
    let text = user.display();  // Should resolve to User's Display impl
}
```

**Test:**
```typescript
it("resolves method from trait implementation", () => {
  const traits_code = `
pub trait Display {
    fn display(&self) -> String;
}
  `;

  const user_code = `
use crate::traits::Display;

pub struct User {
    name: String,
}

impl Display for User {
    fn display(&self) -> String {
        self.name.clone()
    }
}
  `;

  const main_code = `
use crate::user::User;
use crate::traits::Display;

fn main() {
    let user = User { name: String::from("Alice") };
    let text = user.display();
}
  `;

  const traits_index = create_semantic_index_from_code(traits_code, "traits.rs", "rust");
  const user_index = create_semantic_index_from_code(user_code, "user.rs", "rust");
  const main_index = create_semantic_index_from_code(main_code, "main.rs", "rust");

  const indices = new Map([
    ["traits.rs", traits_index],
    ["user.rs", user_index],
    ["main.rs", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  const display_call = find_reference_by_name(main_index, "display", "method");
  const display_impl = find_trait_impl_method(user_index, "User", "Display", "display");

  expect(resolved.resolved_references.get(location_key(display_call.location)))
    .toBe(display_impl.symbol_id);
});
```

### 6. Nested Module Structure

**Code:**
```rust
// utils/string/mod.rs
pub fn trim(s: &str) -> &str {
    s.trim()
}

// utils/mod.rs
pub mod string;

// main.rs
use crate::utils::string::trim;

fn main() {
    let result = trim("  hello  ");  // Should resolve through module hierarchy
}
```

**Test:**
```typescript
it("resolves nested modules", () => {
  const string_code = `
pub fn trim(s: &str) -> &str {
    s.trim()
}
  `;

  const utils_code = `
pub mod string;
  `;

  const main_code = `
use crate::utils::string::trim;

fn main() {
    let result = trim("  hello  ");
}
  `;

  const string_index = create_semantic_index_from_code(string_code, "utils/string/mod.rs", "rust");
  const utils_index = create_semantic_index_from_code(utils_code, "utils/mod.rs", "rust");
  const main_index = create_semantic_index_from_code(main_code, "main.rs", "rust");

  const indices = new Map([
    ["utils/string/mod.rs", string_index],
    ["utils/mod.rs", utils_index],
    ["main.rs", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  const trim_call = find_reference_by_name(main_index, "trim", "function");
  const trim_def = find_definition(string_index, "trim", "function");

  expect(resolved.resolved_references.get(location_key(trim_call.location)))
    .toBe(trim_def.symbol_id);
});
```

### 7. Full Workflow with Repository Pattern

**Code:**
```rust
// models/user.rs
pub struct User {
    pub name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }

    pub fn get_name(&self) -> &str {
        &self.name
    }
}

// repositories/user_repository.rs
use crate::models::user::User;

pub struct UserRepository;

impl UserRepository {
    pub fn save(&self, _user: &User) -> bool {
        true
    }

    pub fn create_user(&self, name: String) -> User {
        User::new(name)
    }
}

// services/user_service.rs
use crate::repositories::user_repository::UserRepository;
use crate::models::user::User;

pub struct UserService {
    repo: UserRepository,
}

impl UserService {
    pub fn new() -> Self {
        UserService {
            repo: UserRepository,
        }
    }

    pub fn register_user(&self, name: String) -> String {
        let user = self.repo.create_user(name);
        self.repo.save(&user);
        String::from(user.get_name())
    }
}

// main.rs
use crate::services::user_service::UserService;

fn main() {
    let service = UserService::new();
    let name = service.register_user(String::from("Alice"));
}
```

**Test:**
```typescript
it("resolves full workflow: use → construct → method call", () => {
  const user_code = `
pub struct User {
    pub name: String,
}

impl User {
    pub fn new(name: String) -> Self {
        User { name }
    }

    pub fn get_name(&self) -> &str {
        &self.name
    }
}
  `;

  const repository_code = `
use crate::models::user::User;

pub struct UserRepository;

impl UserRepository {
    pub fn save(&self, _user: &User) -> bool {
        true
    }

    pub fn create_user(&self, name: String) -> User {
        User::new(name)
    }
}
  `;

  const service_code = `
use crate::repositories::user_repository::UserRepository;
use crate::models::user::User;

pub struct UserService {
    repo: UserRepository,
}

impl UserService {
    pub fn new() -> Self {
        UserService { repo: UserRepository }
    }

    pub fn register_user(&self, name: String) -> String {
        let user = self.repo.create_user(name);
        self.repo.save(&user);
        String::from(user.get_name())
    }
}
  `;

  const main_code = `
use crate::services::user_service::UserService;

fn main() {
    let service = UserService::new();
    let name = service.register_user(String::from("Alice"));
}
  `;

  // Create indices for all files
  const user_index = create_semantic_index_from_code(user_code, "models/user.rs", "rust");
  const repository_index = create_semantic_index_from_code(repository_code, "repositories/user_repository.rs", "rust");
  const service_index = create_semantic_index_from_code(service_code, "services/user_service.rs", "rust");
  const main_index = create_semantic_index_from_code(main_code, "main.rs", "rust");

  const indices = new Map([
    ["models/user.rs", user_index],
    ["repositories/user_repository.rs", repository_index],
    ["services/user_service.rs", service_index],
    ["main.rs", main_index]
  ]);

  const resolved = resolve_symbols(indices);

  // Verify UserService::new in main.rs
  const service_new_call = find_reference_by_name(main_index, "new", "function");
  const service_new_fn = find_impl_method(service_index, "UserService", "new");
  expect(resolved.resolved_references.get(location_key(service_new_call.location)))
    .toBe(service_new_fn.symbol_id);

  // Verify register_user method call in main.rs
  const register_user_call = find_reference_by_name(main_index, "register_user", "method");
  const register_user_method = find_impl_method(service_index, "UserService", "register_user");
  expect(resolved.resolved_references.get(location_key(register_user_call.location)))
    .toBe(register_user_method.symbol_id);

  // Verify create_user method call in UserService
  const create_user_call = find_reference_by_name(service_index, "create_user", "method");
  const create_user_method = find_impl_method(repository_index, "UserRepository", "create_user");
  expect(resolved.resolved_references.get(location_key(create_user_call.location)))
    .toBe(create_user_method.symbol_id);

  // Verify User::new call in UserRepository
  const user_new_call = find_reference_by_name(repository_index, "new", "function");
  const user_new_fn = find_impl_method(user_index, "User", "new");
  expect(resolved.resolved_references.get(location_key(user_new_call.location)))
    .toBe(user_new_fn.symbol_id);
});
```

## Rust-Specific Features to Test

### Use Statements
1. **Absolute paths** - `use crate::module::item;`
2. **Relative paths** - `use super::sibling;`, `use self::child;`
3. **Wildcard imports** - `use module::*;` (if supported)
4. **Nested paths** - `use module::{item1, item2};`
5. **Renaming** - `use module::item as alias;`

### Module System
1. **File modules** - `utils.rs`
2. **Directory modules** - `utils/mod.rs`
3. **Nested modules** - `a/b/c.rs` or `a/b/c/mod.rs`
4. **Inline modules** - `mod name { }`
5. **Re-exports** - `pub use other::item;`

### Types and Traits
1. **Struct methods** - `impl Struct { fn method() }`
2. **Associated functions** - `Struct::new()` vs `obj.method()`
3. **Trait methods** - `impl Trait for Struct`
4. **Default trait impls** - Trait with default methods
5. **Generic impls** - `impl<T> Trait for Struct<T>`

## Success Criteria

### Functional
- ✅ Use statements resolve correctly (`crate::`, `super::`, `self::`)
- ✅ Module hierarchy works (files and directories)
- ✅ Associated functions resolve correctly
- ✅ Method calls resolve correctly
- ✅ Trait implementations resolve correctly
- ✅ Full multi-file workflows work end-to-end

### Coverage
- ✅ At least 15 Rust-specific integration tests
- ✅ Tests cover all use statement variants
- ✅ Tests cover module structure (file vs directory)
- ✅ Tests cover impl blocks and traits
- ✅ Tests use realistic Rust patterns

### Quality
- ✅ Tests use actual Rust indexing pipeline
- ✅ Tests validate module resolution
- ✅ Clear test names and assertions
- ✅ Fast execution (<100ms per test)

## Dependencies

**Uses:**
- task-epic-11.109.8 (Main orchestration)
- Rust indexing pipeline
- Rust module resolver (11.109.3)
- Test helpers from previous tests

**Validates:**
- Rust-specific resolution
- Use statement resolution
- Module hierarchy resolution
- Trait implementation resolution

## Test Helpers

Additional helpers for Rust:

```typescript
/**
 * Find impl block method
 */
function find_impl_method(
  index: SemanticIndex,
  struct_name: SymbolName,
  method_name: SymbolName
): FunctionDefinition {
  const impl_blocks = get_impl_blocks(index, struct_name);
  for (const impl_block of impl_blocks) {
    const method = impl_block.methods.find(m => m.name === method_name);
    if (method) return method;
  }
  throw new Error(`Method ${method_name} not found in impl for ${struct_name}`);
}

/**
 * Find trait impl method
 */
function find_trait_impl_method(
  index: SemanticIndex,
  struct_name: SymbolName,
  trait_name: SymbolName,
  method_name: SymbolName
): FunctionDefinition {
  const trait_impls = get_trait_impls(index, struct_name, trait_name);
  for (const impl_block of trait_impls) {
    const method = impl_block.methods.find(m => m.name === method_name);
    if (method) return method;
  }
  throw new Error(`Method ${method_name} not found in ${trait_name} impl for ${struct_name}`);
}
```

## Notes

### Rust Module Complexity

Rust modules have unique characteristics:
1. **Explicit module tree** - Must declare `mod` to include files
2. **File vs directory** - `utils.rs` vs `utils/mod.rs`
3. **Visibility rules** - `pub` vs private, `pub(crate)`, `pub(super)`
4. **Crate boundaries** - Internal vs external crates

### Testing Strategy

Focus on:
1. **Module hierarchy** - Correct file resolution
2. **Use statement variants** - All path types
3. **Impl blocks** - Methods vs associated functions
4. **Trait system** - Trait impls and default methods

## Next Steps

After completion:
- All 4 language integration test suites complete
- Compare results across languages
- Document any inconsistencies or gaps
- Update main task 11.109.9 with summary findings
