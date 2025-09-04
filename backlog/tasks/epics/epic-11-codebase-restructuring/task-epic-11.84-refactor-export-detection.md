# Task 11.84: Refactor export_detection to Configuration-Driven Pattern

## Overview

Apply the configuration-driven refactoring pattern to the export_detection module. Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Current State

- 4 language-specific files (JS, TS, Python, Rust)
- ~1,252 total lines of code
- Similar export detection logic with different syntax

## Target State

- Configuration for export patterns per language
- Generic export detection and classification
- Expected 70% code reduction (~375 lines total)

## Acceptance Criteria

- [ ] Map export patterns for all languages
- [ ] Define export configuration schema
- [ ] Implement generic export detector
- [ ] Handle re-exports and special cases as bespoke
- [ ] Migrate tests to new structure
- [ ] Ensure compatibility with import_resolution

## Technical Notes

Export patterns:

- ES6: `export`, `export default`, `export { x }`
- CommonJS: `module.exports`, `exports.x`
- Python: `__all__`, implicit exports
- Rust: `pub` modifier, `pub use`

Common elements:

- Symbol visibility detection
- Export type classification
- Re-export handling

## Dependencies

- Pairs with import_resolution (task 11.83)
- Critical for module_graph construction
- Use backlog/tasks/epics/epic-11-codebase-restructuring/refactoring-recipe.md as a guide

## Priority

HIGH - Essential for module boundary analysis

