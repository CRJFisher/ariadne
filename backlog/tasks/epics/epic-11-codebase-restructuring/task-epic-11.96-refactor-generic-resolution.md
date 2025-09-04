# Task 11.96: Refactor generic_resolution to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the generic_resolution module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 3 language-specific files (TS, Python, Rust - no JS)
- Different generic/template systems
- Complex type parameter handling

## Target State

- Configuration for generic syntax
- Generic type parameter resolver
- Expected 40% code reduction

## Acceptance Criteria

- [ ] Map generic type syntax patterns
- [ ] Configure type parameter extraction
- [ ] Build generic resolver
- [ ] Handle type constraints
- [ ] Handle variance annotations
- [ ] Resolve type substitutions

## Technical Notes

Generic patterns:

- TypeScript: `<T>`, type parameters and constraints
- Python: `Generic[T]`, TypeVars
- Rust: `<T>`, lifetime parameters, trait bounds
- No JavaScript (no generics)

Very different systems:

- TypeScript: Structural generics
- Python: Runtime generics via typing module
- Rust: Compile-time monomorphization

## Dependencies

- Part of type analysis system
- Used by function and class analysis
- Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Priority

LOW - Fundamentally different generic systems across languages

