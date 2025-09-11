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

- [x] Map member access syntax patterns
- [x] Configure dot notation vs bracket notation
- [x] Build generic member access detector
- [x] Handle computed property access
- [x] Handle optional chaining (JS/TS)
- [x] Handle Rust's `::` and `.` distinction
- [x] Handle Python's attribute access

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

## Implementation Notes

### Completed Refactoring (2025-09-10)

Successfully refactored the member_access module to use configuration-driven pattern following the refactoring recipe.

**File Structure (Correct Naming Convention):**
- `index.ts` - Module exports ONLY, no implementation (43 lines)
- `language_configs.ts` - Language configurations (168 lines)
- `member_access.ts` - Generic processor with main entry point (182 lines)
- `member_access.javascript.ts` - JavaScript/TypeScript bespoke features (103 lines)
- `member_access.python.ts` - Python bespoke features (73 lines) 
- `member_access.rust.ts` - Rust bespoke features (51 lines)
- `types.ts` - Type definitions (22 lines)

**Key Refactoring Changes:**
1. **Created language_configs.ts** - Centralized configuration for all languages
2. **Refactored member_access.ts** - Configuration-driven detection handling ~85% of cases
3. **Updated language files** - Now only contain truly bespoke handlers:
   - JavaScript: Optional chaining (?.), computed access ([])
   - Python: getattr() dynamic attribute access
   - Rust: field_expression for namespace field access
4. **Fixed index.ts** - Contains ONLY exports, no implementation

**Code Distribution:**
- ~85% configuration-driven (node types, field mappings, skip patterns)
- ~15% bespoke (optional chaining, computed access, getattr, field expressions)

**Key Achievements:**
1. ✅ Unified member access detection through configuration
2. ✅ Common pattern matching for all standard member access
3. ✅ Language-specific features isolated to minimal bespoke handlers
4. ✅ All tests passing (6 tests)
5. ✅ index.ts contains ONLY exports (per refactoring recipe)
6. ✅ Proper separation of concerns
7. ✅ Reduced code duplication significantly

**Configuration Capabilities:**
- Node type mappings (member_expression, attribute, scoped_identifier)
- Field name mappings (object/property, object/attribute, path/name)
- Skip node types for traversal optimization
- Special pattern flags (optional chaining, computed access)

The refactoring successfully separated configuration (names/patterns) from logic (algorithms), achieving proper module organization per the refactoring recipe. While the 60% code reduction target was not fully met (actual ~30% reduction), the code is now properly organized, maintainable, and follows the configuration-driven pattern.

### Post-Refactoring Audit (2025-09-11)

Audited module exports and removed unnecessary public APIs:
1. **Removed from index.ts exports:**
   - `traverse_for_member_access` - Internal function only used by find_member_access_expressions
   - All bespoke handlers (`handle_javascript_*`, `handle_python_*`, `handle_rust_*`) - Only used internally
   
2. **Kept exports:**
   - `find_member_access_expressions` - Used by code_graph.ts (top-level)
   - Configuration functions - Used by type_propagation module
   - Type definitions - Used externally

This cleanup reduces the public API surface and ensures only necessary functions are exposed.
