# Task epic-11.116.7.4: Rust Fixture Verification

**Status:** Not Started
**Parent:** task-epic-11.116.7
**Depends On:** task-epic-11.116.5.4
**Priority:** Medium
**Created:** 2025-10-16

## Overview

Verify that all Rust semantic index JSON fixtures correctly represent their source code files. Rust fixtures cover structs, functions, and modules with 8+ fixtures across 3 categories.

## Fixture Categories to Verify

### 1. Functions (3 fixtures)
- `basic_functions` - Function definitions
- `nested_scopes` - Nested block scopes
- `variable_shadowing` - Variable shadowing in blocks

### 2. Modules (2 fixtures)
- `inline_modules` - Inline mod declarations
- `main` - Main module with use statements

### 3. Structs (3 fixtures)
- `basic_struct` - Struct definition
- `constructor_workflow` - Constructor (new) calling methods
- `user_with_impl` - Struct with impl block

## Verification Approach

For each fixture:

1. **Read source code file** from `packages/core/tests/fixtures/rust/code/{category}/{name}.rs`
2. **Read JSON fixture** from `packages/core/tests/fixtures/rust/semantic_index/{category}/{name}.json`
3. **Verify semantic elements**:
   - All definitions (structs, functions, methods, impl blocks) are captured
   - Associated functions (constructors) vs methods are distinguished
   - Impl blocks are correctly associated with structs
   - Scope hierarchy matches block structure
   - Function calls and references are accurate
   - Use statements and module paths are preserved
   - Source locations are precise
   - Block scopes are properly nested

4. **Document findings**:
   - List verified elements for each fixture
   - Create issue sub-tasks for any discrepancies
   - Note Rust-specific patterns (impl blocks, associated functions, traits)

## Issue Sub-Task Creation

When discrepancies are found, create sub-tasks under this task:
- `task-epic-11.116.7.4.1-Fix-{Issue-Name}.md`
- `task-epic-11.116.7.4.2-Fix-{Issue-Name}.md`
- etc.

Each issue sub-task should:
- Describe the discrepancy (expected vs actual)
- Identify the root cause (indexing logic vs fixture generation)
- Propose a fix
- Reference the specific fixture file(s) affected

## Verification Checklist

### Functions Category
- [ ] `basic_functions.json` - Verify function definitions
- [ ] `nested_scopes.json` - Verify block scopes
- [ ] `variable_shadowing.json` - Verify shadowing in blocks

### Modules Category
- [ ] `inline_modules.json` - Verify mod declarations
- [ ] `main.json` - Verify use statements

### Structs Category
- [ ] `basic_struct.json` - Verify struct definition
- [ ] `constructor_workflow.json` - Verify new()→method calls
- [ ] `user_with_impl.json` - Verify struct + impl association

## Deliverables

- [ ] All 8+ Rust fixtures verified
- [ ] Verification notes documenting semantic accuracy
- [ ] Issue sub-tasks created for any discrepancies (if needed)
- [ ] Summary of Rust-specific patterns (impl blocks, associated functions)

## Success Criteria

- ✅ All fixture categories verified
- ✅ Semantic accuracy confirmed for Rust language features
- ✅ Impl blocks correctly associated with structs
- ✅ Associated functions vs methods properly distinguished
- ✅ Any issues documented as sub-tasks

## Estimated Effort

**2-3 hours**
- Setup and first few fixtures: 0.5 hour
- Systematic verification: 1-1.5 hours
- Issue documentation: 0.5 hour
- Summary and patterns: 0.5 hour

## Notes

- Rust has smaller fixture count but unique patterns
- Impl blocks create a special relationship with structs
- Associated functions (`fn new()`) vs methods (`&self`) must be distinguished
- Block scopes in Rust are significant for ownership/borrowing (not captured in semantic index, but scopes matter)
- Module system uses `use` statements and paths - verify these are captured
