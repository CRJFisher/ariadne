# Task: Update Rust for Direct Definition Builders

## Status: Created

## Parent Task

task-epic-11.102.5 - Update Language Configs

## Objective

Update Rust language support to use the new direct definition builder system, removing all NormalizedCapture dependencies.

## Sub-tasks

1. **Update Language Config** (102.5.4.1)
   - Convert to builder pattern
   - Handle Rust-specific features (traits, impl blocks, lifetimes)
   - Direct Definition creation

2. **Update Query File** (102.5.4.2)
   - Clean up rust.scm
   - Add trait and impl captures
   - Handle generics and lifetimes

3. **Update Tests** (102.5.4.3)
   - Fix language config tests
   - Test Rust-specific features
   - Ensure comprehensive field coverage

## Rust-Specific Requirements

- **Traits** - Trait definitions with associated types and methods
- **Impl blocks** - Implementation blocks for types and traits
- **Structs** - Struct definitions with fields
- **Enums** - Enum definitions with variants
- **Generics** - Type parameters with bounds
- **Lifetimes** - Lifetime parameters
- **Macros** - Macro definitions and invocations
- **Modules** - Module definitions and visibility
- **Use statements** - Import statements with aliasing
- **Associated types** - Type definitions in traits/impls
- **Const/Static** - Constant and static definitions
- **Unsafe** - Unsafe blocks and functions

## Success Criteria

- [ ] Rust config uses builder pattern
- [ ] All Rust-specific features captured
- [ ] Query file contains only necessary captures
- [ ] All Rust tests pass
- [ ] 100% coverage of processed fields

## Dependencies

- task-epic-11.102.1, 102.2, 102.3 (Builder systems exist)
- task-epic-11.102.4 (Old types removed)

## Estimated Effort

~4 hours total (complex type system)