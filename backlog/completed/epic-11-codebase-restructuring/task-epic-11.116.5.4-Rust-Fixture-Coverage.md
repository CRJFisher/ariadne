# Task epic-11.116.5.4: Verify Rust Fixture Coverage for Registry Tests

**Status:** Audit Completed - Critical Gaps Identified
**Parent:** task-epic-11.116.5
**Priority:** High
**Created:** 2025-10-15

## Overview

Verify that Rust fixtures cover registry integration test scenarios. Rust currently has minimal coverage and will need significant additions, particularly for impl blocks, traits, and modules.

## Current Rust Fixtures

```
rust/semantic_index/
├── enums/
│   └── (empty) ❌
├── functions/
│   └── basic_functions.json ✅
├── impls/
│   └── (empty) ❌
├── modules/
│   └── (empty) ❌
├── structs/
│   └── basic_struct.json ✅
└── traits/
    └── (empty) ❌
```

**Status:** Very sparse coverage. Missing most Rust-specific features.

## Integration Test Requirements

### 1. Basic Resolution
- [ ] Local function calls → **CHECK**: `functions/basic_functions.json` (verify includes calls)

### 2. Cross-Module Resolution
- [ ] Imported function calls → **MISSING**: Need module examples
- [ ] Imported struct methods → **MISSING**: Need impl blocks + modules

### 3. Shadowing Scenarios
- [ ] Local definition shadows import → **MISSING**: Need shadowing example

### 4. Complete Workflows
- [ ] Constructor → type → method chain → **MISSING**: Need impl block examples

### 5. Rust-Specific Features
- [ ] Impl blocks (methods on structs) → **MISSING**: Critical for Rust
- [ ] Traits (interface definitions) → **MISSING**: Important for Rust
- [ ] Trait implementations → **MISSING**: Important for Rust
- [ ] Module system (mod, use) → **MISSING**: Critical for Rust
- [ ] Associated functions (::new) → **MISSING**: Common pattern

## Tasks

### Step 1: Audit Existing Fixtures (15 min)

Check current fixtures:

| Test Scenario | Required Fixture | Status | Action |
|--------------|-----------------|--------|--------|
| Local function call | `functions/basic_functions.json` | ✅ Exists | Verify includes calls |
| Struct with impl | `impls/basic_impl.json` | ❌ Missing | **HIGH PRIORITY** |
| Module imports | `modules/imports.json` | ❌ Missing | Create |
| Trait definition | `traits/basic_trait.json` | ❌ Missing | Create |
| Trait impl | `impls/trait_impl.json` | ❌ Missing | Create |
| Associated functions | `structs/associated_fns.json` | ❌ Missing | Create |
| Local shadows import | `modules/shadowing.json` | ❌ Missing | Create |
| Method workflow | `impls/method_chain.json` | ❌ Missing | Create |

### Step 2: Create Missing Code Fixtures (3-4 hours)

**Priority 1: Impl Blocks (CRITICAL)**

```rust
// rust/code/structs/user_with_impl.rs
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

// Usage in same file
fn main() {
    let user = User::new("Alice".to_string());
    let name = user.get_name();
}
```

**Priority 2: Module System**

```rust
// rust/code/modules/utils.rs
pub fn helper() -> &'static str {
    "helper"
}

// rust/code/modules/main.rs
mod utils;
use utils::helper;

fn main() {
    helper();
}
```

**Priority 3: Traits**

```rust
// rust/code/traits/displayable.rs
pub trait Displayable {
    fn display(&self) -> String;
}

pub struct Message {
    content: String,
}

impl Displayable for Message {
    fn display(&self) -> String {
        self.content.clone()
    }
}

fn main() {
    let msg = Message { content: "Hello".to_string() };
    msg.display();
}
```

**Priority 4: Method Chaining**

```rust
// rust/code/impls/builder_pattern.rs
pub struct Calculator {
    result: i32,
}

impl Calculator {
    pub fn new() -> Self {
        Calculator { result: 0 }
    }

    pub fn add(&mut self, x: i32) -> &mut Self {
        self.result += x;
        self
    }

    pub fn multiply(&mut self, x: i32) -> &mut Self {
        self.result *= x;
        self
    }

    pub fn get_result(&self) -> i32 {
        self.result
    }
}

fn main() {
    let mut calc = Calculator::new();
    let result = calc.add(5).multiply(2).get_result();
}
```

**Priority 5: Cross-Module Structs**

```rust
// rust/code/modules/user_mod.rs
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

// rust/code/modules/uses_user.rs
mod user_mod;
use user_mod::User;

fn main() {
    let user = User::new("Alice".to_string());
    let name = user.get_name();
}
```

**Priority 6: Shadowing**

```rust
// rust/code/modules/shadowing.rs
mod utils {
    pub fn helper() -> &'static str {
        "imported"
    }
}

use utils::helper;

// Local function shadows import
fn helper() -> &'static str {
    "local"
}

fn main() {
    helper(); // Should resolve to local
}
```

### Step 3: Generate Semantic Index JSON (1 hour)

```bash
npm run generate-fixtures:rust -- rust/code/structs/user_with_impl.rs
npm run generate-fixtures:rust -- rust/code/modules/utils.rs
npm run generate-fixtures:rust -- rust/code/modules/main.rs
npm run generate-fixtures:rust -- rust/code/traits/displayable.rs
npm run generate-fixtures:rust -- rust/code/impls/builder_pattern.rs
npm run generate-fixtures:rust -- rust/code/modules/user_mod.rs
npm run generate-fixtures:rust -- rust/code/modules/uses_user.rs
npm run generate-fixtures:rust -- rust/code/modules/shadowing.rs
```

### Step 4: Verify Rust-Specific Features (1 hour)

Check that fixtures correctly capture:
- [ ] Impl block boundaries (separate from struct definition)
- [ ] Associated functions (::new syntax)
- [ ] Method calls (&self, &mut self)
- [ ] Trait definitions
- [ ] Trait implementations (impl Trait for Type)
- [ ] Module declarations (mod, use)
- [ ] Visibility modifiers (pub)
- [ ] Ownership patterns (if relevant)

## Success Criteria

- [ ] All integration test scenarios have Rust fixtures
- [ ] Impl blocks correctly captured
- [ ] Module system covered (mod, use)
- [ ] Trait definitions and implementations covered
- [ ] Associated functions (::new) captured
- [ ] Method chaining scenarios covered
- [ ] Shadowing scenarios covered
- [ ] All JSON fixtures validated

## Estimated Effort

**4-5 hours**
- 15 min: Audit existing fixtures
- 3-4 hours: Create missing code fixtures (many Rust-specific features)
- 1 hour: Generate JSON for all fixtures
- 1 hour: Verify Rust-specific feature capture

## Deliverables

- [ ] Fixture coverage mapping table
- [ ] New Rust code fixtures (impl blocks, traits, modules)
- [ ] Generated semantic index JSON files
- [ ] Validation report for Rust-specific features

## Notes

- Rust has the most gaps due to language complexity
- **Impl blocks are CRITICAL** - most Rust code uses them
- Traits are a key Rust feature - must be tested
- Module system is different from other languages
- Associated functions (::new) are a common pattern
- Consider async/await if it's a common pattern
- Ownership/borrowing may affect symbol resolution
- Check macro handling if macros appear in test code

## COMPREHENSIVE AUDIT RESULTS

### Audit Findings

**🔍 INTEGRATION TEST SCENARIOS REQUIRED:**
1. **Basic Resolution** - Local function calls
2. **Cross-Module Resolution** - Imported function calls and imported struct/impl methods
3. **Shadowing Scenarios** - Local definition shadows import
4. **Complete Workflows** - Constructor → type → method chain (struct instantiation → method calls)
5. **Nested Function Scopes** - Calls at different scope levels
6. **Method and Constructor Calls** - Type-based resolution (impl blocks)

### Current Rust Coverage Analysis

**✅ EXISTING COVERAGE:**

1. **Basic Resolution** - Local function calls
   - **Status:** ✅ **PARTIAL COVERAGE**
   - **Fixture:** `functions/basic_functions.json`
   - **Code:** `functions/basic_functions.rs`
   - **Analysis:** Contains function definitions and call chains (`call_chain()` → `fetch_data()` → `transform_data()`)
   - **Gaps:** No nested function scopes for `enclosing_function_scope_id` testing

2. **Struct Definitions**
   - **Status:** ⚠️ **BASIC COVERAGE**
   - **Fixture:** `structs/basic_struct.json`
   - **Code:** `structs/basic_struct.rs`
   - **Analysis:** Has struct definition but **NO IMPL BLOCK** - critical gap for Rust
   - **Gaps:** No methods, no associated functions, no constructors

**❌ CRITICAL GAPS IDENTIFIED:**

3. **Impl Blocks (CRITICAL FOR RUST)**
   - **Status:** ❌ **COMPLETELY MISSING**
   - **Required:** Struct with impl block containing methods and associated functions
   - **Impact:** Cannot test Rust's primary method definition system

4. **Cross-Module Resolution**
   - **Function imports/calls:** ❌ **MISSING ENTIRELY**
   - **Struct/method imports:** ❌ **MISSING ENTIRELY**
   - **Module system:** ❌ **NO MODULE FIXTURES AT ALL**
   - **Impact:** Cannot test Rust's `mod`/`use` system

5. **Shadowing Scenarios**
   - **Status:** ❌ **MISSING ENTIRELY**
   - **Required:** Local function shadows imported function
   - **Impact:** Cannot test lexical scope resolution priority

6. **Complete Workflows**
   - **Struct → impl → method chain:** ❌ **MISSING**
   - **Associated functions (::new):** ❌ **MISSING**
   - **Current state:** Has struct definition but no instantiation or method calls
   - **Impact:** Cannot test type binding and method resolution chains

7. **Rust-Specific Features**
   - **Traits:** ❌ **MISSING ENTIRELY**
   - **Trait implementations:** ❌ **MISSING ENTIRELY**
   - **Associated functions:** ❌ **MISSING ENTIRELY**
   - **Method calls on instances:** ❌ **MISSING ENTIRELY**

### Coverage Mapping Table

| Integration Test Scenario | Required Fixture | Status | Coverage Level |
|---------------------------|------------------|--------|----------------|
| Local function calls | `functions/basic_functions.json` | ✅ EXISTS | **PARTIAL** - Missing nested scopes |
| Import function calls | `modules/utils.json` + `modules/main.json` | ❌ MISSING | **NONE** |
| Import struct methods | `modules/user_mod.json` + `modules/uses_user.json` | ❌ MISSING | **NONE** |
| Local shadows import | `modules/shadowing.json` | ❌ MISSING | **NONE** |
| Struct → impl → method | `structs/user_with_impl.json` | ❌ MISSING | **NONE** |
| Nested function scopes | `functions/nested_scopes.json` | ❌ MISSING | **NONE** |

### Priority Ranking for Missing Fixtures

**🔴 CRITICAL (P1) - Rust Core Features:**
1. **Impl blocks with methods** - ESSENTIAL for Rust
2. **Associated functions (::new)** - Common constructor pattern
3. **Cross-module resolution** (mod/use system)

**🟡 HIGH (P2) - Integration Test Requirements:**
4. **Cross-module struct/method resolution**
5. **Shadowing scenarios**
6. **Traits and trait implementations**

**🟢 MEDIUM (P3) - Complete Coverage:**
7. **Nested function scopes for enclosing_function_scope_id**

### Fixture Creation Requirements

**MINIMUM VIABLE FIXTURES NEEDED (8 new files):**

**Impl Blocks (CRITICAL):**
- `rust/code/structs/user_with_impl.rs` - Struct with impl block, methods, and associated functions

**Module System:**
- `rust/code/modules/utils.rs` - Module with public functions
- `rust/code/modules/main.rs` - Uses module functions with `use` statements

**Cross-Module Structs:**
- `rust/code/modules/user_mod.rs` - Module with struct and impl block
- `rust/code/modules/uses_user.rs` - Imports struct, creates instance, calls methods

**Shadowing:**
- `rust/code/modules/shadowing.rs` - Imports function but defines local function with same name

**Workflows:**
- `rust/code/structs/constructor_workflow.rs` - Struct instantiation and method calls in same file

**Nested Scopes:**
- `rust/code/functions/nested_scopes.rs` - Nested functions for scope testing

### Rust-Specific Features to Verify

**🔴 CRITICAL MISSING:**
- Impl block boundaries (separate from struct definition)
- Associated functions (`::new`, `::default` syntax)
- Method calls (`&self`, `&mut self`)
- Visibility modifiers (`pub`, `pub(crate)`)

**🟡 IMPORTANT MISSING:**
- Trait definitions (`trait Display`)
- Trait implementations (`impl Display for User`)
- Module declarations (`mod utils`)
- Use statements (`use crate::utils::helper`)

**🟢 NICE TO HAVE:**
- Builder pattern with method chaining
- Generic structs/functions
- Ownership patterns (if relevant to resolution)

### Estimated Effort

**TOTAL: 5-6 hours**
- **Analysis:** ✅ COMPLETED (30 minutes)
- **Code fixture creation:** 3-4 hours (8 new files + Rust complexity)
- **JSON generation:** 1 hour
- **Validation:** 1 hour (Rust-specific features)

**RESULT: ❌ CRITICAL GAPS** - Rust has the most severe gaps due to missing core language features (impl blocks, modules) that are essential for realistic Rust code.

## Rust-Specific Challenges

1. **Impl Blocks**: Methods are defined separately from structs
2. **Associated Functions**: Called with :: not .
3. **Traits**: Interface system is complex
4. **Module System**: Uses mod + use, different from import/export
5. **Self vs self**: Type vs instance in method signatures
