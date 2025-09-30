# Task: Validate and Fix Rust Capture Names

**Status**: Not Started
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.103

## Objective

Fix all invalid capture names in `rust.scm` and update `rust_builder.ts` accordingly.

## Current Issues (182 invalid captures - most in codebase)

### Invalid scope entities (Rust-specific constructs):

- `@scope.struct` → map to `@scope.class` or add `struct` to SemanticEntity
- `@scope.trait` → map to `@scope.interface`
- `@scope.impl` → map to `@scope.block` or `@scope.class`
- `@scope.if/match/for/while/loop/match_arm` → should be `@scope.block`

### Invalid definition entities:

- `@definition.struct` → map to `@definition.class` or add to enum
- `@definition.param` → should be `@definition.parameter`
- `@definition.loop_var` → should be `@definition.variable`
- `@definition.const_param` → should be `@definition.parameter`
- Rust-specific: `enum_variant`, `trait_method`, `associated_type`, `associated_const`

### Pattern matching (extensive Rust feature):

- All `@pattern.X` → should be `@reference.X` with appropriate entities
- Pattern destructuring needs valid entities

### Ownership and lifetimes (Rust-specific):

- All `@ownership.X` → map to `@reference.X` or `@modifier.X`
- All `@lifetime.X` → map to `@type.X`
- Smart pointer patterns → map to `@type.X`

### Macro system:

- `@macro.definition` → should use valid entity (maybe `@definition.macro`)
- Macro invocations → should be `@reference.macro`

### Import/export patterns:

- Many Rust-specific import patterns need validation
- `@import.name/declaration/alias` → use valid entities
- Visibility modifiers → ensure valid

### References:

- Similar patterns to other languages
- Additional Rust patterns like `borrowed`, `dereferenced`, `associated_function`

## Strategy

Consider adding Rust-specific entities to SemanticEntity enum:

- `struct` (or map to `class`)
- `trait` (or map to `interface`)
- `lifetime`
- `borrow`
- Pattern-related entities

## Files to Update

- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.test.ts`
- Potentially `scope_processor.ts` to add Rust-specific entities

## Acceptance Criteria

- [ ] All captures in rust.scm have valid category and entity
- [ ] Language config updated to match
- [ ] Validation script reports 0 invalid captures for Rust
- [ ] Rust semantic index tests pass
- [ ] Document any new SemanticEntity values added
