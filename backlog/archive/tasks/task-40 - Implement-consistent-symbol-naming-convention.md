---
id: task-40
title: Implement consistent symbol naming convention
status: Done
assignee: []
created_date: '2025-07-18'
updated_date: '2025-07-18'
labels: []
dependencies: []
---

## Description

Establish and implement a consistent symbol naming scheme for call graph nodes using the format <module_path>#<name> to uniquely identify symbols across the codebase.

## Acceptance Criteria

- [x] Symbol naming format defined and documented
- [x] Module path extraction implemented for all languages
- [x] Symbol names include full qualified path
- [x] Nested symbols properly represented
- [x] Method symbols include container class
- [x] Cross-file symbol references use consistent format
- [x] Symbol resolution uses the naming convention
- [x] Unit tests verify naming consistency
- [x] Documentation includes naming examples

## Implementation Plan

1. Analyze current symbol handling in the codebase
2. Design symbol naming convention with format <module_path>#<symbol_name>
3. Create decision document for symbol naming design
4. Implement core symbol naming utilities in symbol_naming.ts
5. Add support for module path normalization (cross-platform)
6. Handle nested symbols (methods in classes) with dot notation
7. Add comprehensive unit tests for all naming functions
8. Export new utilities from index.ts

## Implementation Notes

Implemented a comprehensive symbol naming convention with the format <module_path>#<symbol_name>:

1. Created symbol_naming.ts module with utilities for:
   - get_symbol_id(): Generate unique symbol IDs from Def objects
   - parse_symbol_id(): Parse symbol IDs into components
   - normalize_module_path(): Normalize file paths cross-platform
   - get_qualified_name(): Handle nested symbols with dot notation

2. Created two decision documents:
   - symbol-naming-convention.md: Detailed design and rules
   - Referenced in task documentation

3. Features implemented:
   - Cross-platform path normalization (forward slashes)
   - Extension removal for module paths
   - Nested symbol support (e.g., User.validate for methods)
   - Anonymous function handling with position-based naming
   - Comprehensive parsing and utility functions

4. Added 33 unit tests covering all edge cases
5. Exported utilities from index.ts for public API

The implementation provides a solid foundation for building call graphs with unique, consistent symbol identifiers.
