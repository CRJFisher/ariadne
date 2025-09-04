# Task 11.85: Refactor scope_tree to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the scope_tree module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 4 language-specific files (JS, TS, Python, Rust)
- Different scope rules and block structures per language
- Complex scope hierarchies

## Target State

- Configuration for scope-creating constructs
- Generic scope tree builder
- Bespoke handling for unique scope rules

## Acceptance Criteria

- [ ] Map scope-creating constructs per language
- [ ] Define scope configuration (block types, binding rules)
- [ ] Build generic scope tree constructor
- [ ] Handle special scoping (Python's LEGB, Rust lifetimes)
- [ ] Maintain scope chain accuracy
- [ ] Test against nested scope scenarios

## Technical Notes

Scope patterns vary:

- JavaScript: Function scope, block scope (let/const)
- Python: LEGB rule (Local, Enclosing, Global, Built-in)
- Rust: Ownership and lifetime scopes
- TypeScript: Namespace and module scopes

Likely needs more bespoke logic than call detection modules.

## Dependencies

- Foundation for symbol_resolution
- Used by type_tracking and variable analysis
- Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Priority

MEDIUM - More complex scoping rules may limit configuration benefits

