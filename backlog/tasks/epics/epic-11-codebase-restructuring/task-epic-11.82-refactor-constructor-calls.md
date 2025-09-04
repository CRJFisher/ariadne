# Task 11.82: Refactor constructor_calls to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the constructor_calls module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 4 language-specific files (JS, TS, Python, Rust)
- ~1,152 total lines of code across language files
- Duplication in constructor detection patterns

## Target State

- Generic processor with configuration for constructor patterns
- Bespoke handling only for unique constructor semantics
- Expected 70% code reduction (~350 lines total)

## Acceptance Criteria

- [ ] Identify common constructor patterns across languages
- [ ] Create configuration for constructor detection rules
- [ ] Implement generic constructor detection
- [ ] Handle language-specific constructor features as bespoke
- [ ] Migrate and reorganize tests
- [ ] Maintain 100% test coverage

## Technical Notes

Constructor patterns vary significantly:

- JavaScript/TypeScript: `new` keyword
- Python: Capitalized function calls, `__init__` methods
- Rust: Associated functions, struct literals
- Different syntactic indicators per language

## Dependencies

- Uses backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md pattern
- May coordinate with class_detection module

## Priority

HIGH - Core call graph functionality, high duplication

