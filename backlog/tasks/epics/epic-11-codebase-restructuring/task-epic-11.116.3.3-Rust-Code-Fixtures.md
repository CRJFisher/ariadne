# Task epic-11.116.3.3: Rust Code Fixtures - Audit and Reorganization

**Status:** Not Started
**Parent:** task-epic-11.116.3
**Language:** Rust
**Priority:** High
**Estimated Effort:** 1.5 hours

## Objective

Audit existing Rust fixtures, reorganize them into the new folder structure, and ensure comprehensive coverage of Rust-specific language features.

## Current State

**Location:** `packages/core/tests/fixtures/rust/`

**Existing fixtures:**
- module_edge_cases.rs
- ownership_and_patterns.rs
- ownership_and_references.rs
- patterns_and_error_handling.rs
- advanced_constructs_comprehensive.rs

## Tasks

### 1. Audit Existing Fixtures

Review each fixture file and categorize by Rust language features.

### 2. Create Category Structure

Create new folder structure:
```
fixtures/rust/code/
├── structs/
├── enums/
├── traits/
├── modules/
├── functions/
├── generics/
├── ownership/
├── impl_blocks/
└── patterns/
```

### 3. Reorganize Fixtures

#### Structs Category
- `basic_struct.rs` - Simple struct definition
- `tuple_struct.rs` - Tuple structs
- `unit_struct.rs` - Unit structs
- `struct_methods.rs` - Struct with impl block
- `struct_generics.rs` - Generic structs

From existing:
- Extract from `advanced_constructs_comprehensive.rs`

#### Enums Category
- `basic_enum.rs` - Simple enum
- `enum_variants.rs` - Enum with different variant types
- `enum_methods.rs` - Enum with impl block
- `pattern_matching.rs` - Match on enums

From existing:
- Split from `patterns_and_error_handling.rs`

#### Traits Category
- `trait_definition.rs` - Trait definition
- `trait_implementation.rs` - Implementing traits
- `trait_bounds.rs` - Trait bounds on generics
- `default_impl.rs` - Default trait implementations
- `associated_types.rs` - Associated types in traits

From existing:
- Extract from `advanced_constructs_comprehensive.rs`

#### Modules Category
- `basic_module.rs` - mod declarations
- `use_statements.rs` - use imports
- `pub_use.rs` - Re-exports with pub use
- `module_visibility.rs` - pub/private modules

From existing:
- Use and split `module_edge_cases.rs`

#### Functions Category
- `function_definition.rs` - fn definitions
- `closures.rs` - Closure syntax
- `function_pointers.rs` - fn pointers
- `impl_fn.rs` - Functions in impl blocks

#### Generics Category
- `generic_functions.rs` - Generic function definitions
- `generic_structs.rs` - Generic struct definitions
- `generic_traits.rs` - Generic traits
- `lifetime_generics.rs` - Lifetime parameters

#### Ownership Category
- `ownership_basics.rs` - Move semantics
- `references.rs` - & and &mut
- `borrowing.rs` - Borrow checker examples
- `lifetimes.rs` - Lifetime annotations

From existing:
- Split `ownership_and_patterns.rs`
- Split `ownership_and_references.rs`

#### Impl Blocks Category
- `basic_impl.rs` - Basic impl block
- `trait_impl.rs` - Trait implementation
- `associated_functions.rs` - Associated functions (::new)
- `methods.rs` - Instance methods (&self)

#### Patterns Category
- `match_patterns.rs` - Match expressions
- `if_let.rs` - if let patterns
- `destructuring.rs` - Pattern destructuring

From existing:
- Split `patterns_and_error_handling.rs`

### 4. Create Missing Fixtures

Rust-specific features that may need new fixtures:
- [ ] `structs/basic_struct.rs`
- [ ] `traits/trait_definition.rs`
- [ ] `traits/trait_implementation.rs`
- [ ] `functions/closures.rs`
- [ ] `generics/generic_traits.rs`
- [ ] `impl_blocks/basic_impl.rs`
- [ ] `modules/pub_use.rs`

### 5. File Naming Convention

Use descriptive, snake_case names (Rust convention):
- ✓ `basic_struct.rs`
- ✓ `trait_implementation.rs`
- ✓ `ownership_basics.rs`

### 6. Fixture Quality Guidelines

Each fixture should:
- Focus on ONE specific Rust feature
- Follow Rust style guidelines (rustfmt)
- Include comments explaining ownership/borrowing where relevant
- Be concise and focused
- Compile without errors (valid Rust)

**Example:**
```rust
// fixtures/rust/code/structs/basic_struct.rs
/// Tests basic struct definition and implementation
///

struct Animal {
    name: String,
}

struct Dog {
    name: String,
    breed: String,
}

impl Dog {
    fn new(name: String, breed: String) -> Self {
        Dog { name, breed }
    }

    fn speak(&self) -> String {
        "Woof!".to_string()
    }

    fn fetch(&self) {
        println!("{} is fetching", self.name);
    }
}

pub use Dog;
```

## Deliverables

- [ ] All existing Rust fixtures reviewed and categorized
- [ ] New folder structure created: `fixtures/rust/code/{category}/`
- [ ] All fixtures reorganized into appropriate categories
- [ ] Large comprehensive files split into focused fixtures
- [ ] Missing high-priority fixtures created
- [ ] All fixtures are valid Rust code
- [ ] Rust feature coverage documented

## Feature Coverage Checklist

Rust-specific features to ensure coverage:

### Structs
- [ ] Basic struct definition
- [ ] Tuple structs
- [ ] Unit structs
- [ ] Generic structs
- [ ] Struct update syntax

### Enums
- [ ] Basic enums
- [ ] Enums with data
- [ ] Pattern matching on enums
- [ ] Option and Result (if relevant)

### Traits
- [ ] Trait definition
- [ ] Trait implementation
- [ ] Trait bounds
- [ ] Default implementations
- [ ] Associated types

### Modules
- [ ] mod declarations
- [ ] use statements
- [ ] pub use re-exports
- [ ] Visibility (pub/private)
- [ ] Module paths

### Functions
- [ ] fn definitions
- [ ] Closures
- [ ] Function pointers
- [ ] Associated functions

### Generics
- [ ] Generic functions
- [ ] Generic structs
- [ ] Generic traits
- [ ] Lifetime parameters
- [ ] Trait bounds on generics

### Ownership
- [ ] Move semantics
- [ ] References (&, &mut)
- [ ] Borrowing rules
- [ ] Lifetime annotations

### Impl Blocks
- [ ] Basic impl
- [ ] Trait impl
- [ ] Associated functions (::new)
- [ ] Instance methods (&self, &mut self)

### Patterns
- [ ] match expressions
- [ ] if let
- [ ] Destructuring
- [ ] Pattern guards

## Acceptance Criteria

- [ ] All Rust fixtures reorganized into new structure
- [ ] No "comprehensive_*" or overly broad files remain
- [ ] Feature coverage checklist 100% complete
- [ ] All fixtures compile (valid Rust)
- [ ] Documentation of Rust coverage complete

## Notes

- Rust doesn't have classes - use structs with impl blocks
- Focus on borrow checker features (ownership, lifetimes)
- Ensure fixtures demonstrate Rust-specific patterns
- Some fixtures may need to be multi-file for module tests
