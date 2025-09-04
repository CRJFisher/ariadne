# Task 11.91: Refactor symbol_resolution to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the symbol_resolution module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 4 language-specific files (JS, TS, Python, Rust)
- Different symbol lookup rules
- Complex resolution algorithms

## Target State

- Configuration for symbol lookup patterns
- Generic symbol resolver
- Expected 50-60% code reduction

## Acceptance Criteria

- [ ] Map symbol resolution rules per language
- [ ] Configure lookup order and scope chains
- [ ] Build generic resolver
- [ ] Handle hoisting (JavaScript)
- [ ] Handle LEGB rule (Python)
- [ ] Handle module paths (Rust)

## Technical Notes

Resolution patterns:

- JavaScript: Hoisting, closure scopes
- TypeScript: Type-level symbols
- Python: LEGB (Local, Enclosing, Global, Built-in)
- Rust: Module paths, use statements

Complex due to:

- Different scoping rules
- Import resolution integration
- Type vs value namespaces

## Dependencies

- Depends on scope_tree
- Critical for all analysis
- Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Priority

MEDIUM - Complex but important for accuracy

