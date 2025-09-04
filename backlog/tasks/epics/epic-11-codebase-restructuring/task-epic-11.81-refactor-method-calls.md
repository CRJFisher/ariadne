# Task 11.81: Refactor method_calls to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the method_calls module, following the recipe established in function_calls refactoring. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 4 language-specific files (JS, TS, Python, Rust)
- ~1,446 total lines of code across language files
- Significant duplication in method detection logic

## Target State

- Single generic processor with language configurations
- Language-specific files only for truly unique features
- Expected 70% code reduction (~450 lines total)

## Acceptance Criteria

- [ ] Analyze all 4 language implementations to identify common patterns
- [ ] Create language_configs.ts with method call configurations
- [ ] Implement generic processor in method_calls.ts
- [ ] Move bespoke features to language-specific files (if any)
- [ ] Reorganize tests to mirror code structure
- [ ] All existing tests pass
- [ ] Document any unique language features that remain bespoke

## Technical Notes

Method calls likely differ primarily in:

- Member access syntax (dot notation vs different operators)
- Method expression node types
- Optional chaining syntax
- Static vs instance method differentiation

## Dependencies

- Follows pattern from task 11.80 (function_calls refactoring)
- Uses backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as guide

## Priority

HIGH - Direct sibling to function_calls, similar complexity and impact

