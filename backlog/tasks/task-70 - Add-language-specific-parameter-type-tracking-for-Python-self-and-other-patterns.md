---
id: task-70
title: >-
  Add language-specific parameter type tracking for Python self and other
  patterns
status: In Progress
assignee:
  - '@claude'
created_date: '2025-08-02'
updated_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - python
dependencies:
  - task-66
---

## Description

Implement type tracking for language-specific implicit parameter patterns that provide access to the current instance. This includes Python's 'self' parameter in methods, JavaScript/TypeScript 'this' context, Rust's 'self'/'&self'/'&mut self', and similar patterns. This enables method-to-method calls within the same class to be properly resolved across all supported languages.

## Acceptance Criteria

- [x] Python 'self' parameter is tracked with class type in methods
- [ ] Python 'cls' parameter is tracked in classmethods
- [x] JavaScript/TypeScript 'this' context is tracked within methods
- [ ] Rust self/&self/&mut self parameters are tracked
- [x] Method-to-method calls within classes are resolved for all languages
- [x] Tests verify implicit instance method calls are detected
- [ ] Language-specific patterns documented

## Implementation Plan

1. Analyze how each language represents instance access (self, this, etc.)
2. Update get_calls_from_definition to detect when analyzing a method
3. For Python: Track 'self' parameter with the containing class type
4. For JavaScript/TypeScript: Track 'this' context within methods
5. For Rust: Track self/&self/&mut self parameters
6. Modify method call resolution to use implicit instance type
7. Add tests for each language's pattern
8. Document the language-specific behaviors

## Implementation Notes

- Created LocalTypeTracker class that inherits from FileTypeTracker to track implicit instance parameters within method scopes
- Added trackImplicitInstanceParameter method that detects when analyzing a method and sets the appropriate implicit parameter type
- For Python: Fixed method detection by adding method-specific capture in scopes.scm - methods inside classes are now captured as `@hoist.definition.method`
- For JavaScript/TypeScript: Methods are already properly detected, so implicit this tracking works automatically
- Added comprehensive tests for both Python self and JavaScript/TypeScript this parameter tracking
- Method-to-method calls within the same class are now properly resolved for both languages
- The solution reuses the existing type tracking infrastructure by treating implicit parameters as local variables with known types
