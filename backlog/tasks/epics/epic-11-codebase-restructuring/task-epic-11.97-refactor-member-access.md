# Task 11.97: Refactor member_access to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the member_access module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 3 language-specific files (JS, Python, Rust - no TS)
- Different member access syntax across languages
- Property and method access detection

## Target State

- Configuration for member access patterns
- Generic member access processor
- Expected 60% code reduction

## Acceptance Criteria

- [ ] Map member access syntax patterns
- [ ] Configure dot notation vs bracket notation
- [ ] Build generic member access detector
- [ ] Handle computed property access
- [ ] Handle optional chaining (JS/TS)
- [ ] Handle Rust's `::` and `.` distinction
- [ ] Handle Python's attribute access

## Technical Notes

Member access patterns:

- JavaScript: `.property`, `[computed]`, `?.optional`
- Python: `.attribute`, `getattr()`
- Rust: `::associated`, `.method`, `.field`

Common elements:

- Object/receiver identification
- Member name extraction
- Access type classification

## Dependencies

- Used by method_calls for receiver detection
- Used by type_tracking for property types
- Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Priority

MEDIUM - Foundational AST utility, moderate duplication
