# Task 11.86: Refactor class_detection to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the class_detection module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 4 language-specific files (JS, TS, Python, Rust)
- Different class syntax across languages
- Similar extraction logic for class metadata

## Target State

- Configuration for class declaration patterns
- Generic class metadata extractor
- Expected 60% code reduction

## Acceptance Criteria

- [ ] Map class declaration syntax per language
- [ ] Configure class member detection patterns
- [ ] Build generic class detector
- [ ] Handle special features (decorators, traits) as bespoke
- [ ] Extract inheritance relationships consistently
- [ ] Test with complex class hierarchies

## Technical Notes

Class patterns:

- JavaScript/TypeScript: `class` keyword, extends
- Python: `class` keyword, multiple inheritance
- Rust: `struct`, `impl` blocks, traits

Common extraction:

- Class name
- Base classes/interfaces
- Member methods and properties
- Access modifiers

## Dependencies

- Feeds into class_hierarchy builder
- Used by method_override detection
- Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Priority

MEDIUM - Important for OOP analysis, moderate complexity

