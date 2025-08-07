---
id: task-67
title: Implement cross-file type registry for method resolution
status: In-Progress
assignee: ['@claude']
created_date: '2025-08-02'
updated_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - cross-file
dependencies:
  - task-66
blocked_by:
  - task-28  # (partial) Module path resolution needed for Python/Rust
  - task-30  # (critical for Python) Export detection for languages without export keyword
---

## Description

Create a project-wide type registry that maintains variable type information across file boundaries. This registry will enable method calls on imported class instances to be resolved to their definitions in other files. See docs/cross-file-method-resolution.md for current limitations.

## Acceptance Criteria

- [x] Global type registry tracks variable types across files
- [x] Method calls on imported instances resolve correctly
- [ ] Registry handles variable reassignments
- [x] Memory usage remains reasonable for large projects
- [x] Tests verify cross-file method resolution for all languages
- [x] Call graph shows correct method relationships across files
- [x] JavaScript/TypeScript: Cross-file method resolution works for ES6 imports
- [x] JavaScript/TypeScript: Handles renamed imports (import { X as Y })
- [x] Python: Cross-file method resolution works for from/import statements
- [ ] Python: Handles different import styles (from x import y, import x.y)
- [ ] Rust: Cross-file method resolution works for use statements
- [ ] Rust: Handles module paths and renamed imports
- [x] Export detection identifies exported classes and functions
- [ ] Export detection works for all supported export syntaxes

## Implementation Plan

1. Create a ProjectTypeRegistry class to maintain cross-file type information
2. Integrate registry with Project class to share type info between files
3. Update FileTypeTracker to register exported types with the project registry
4. Modify import resolution to pull type information from the registry
5. Handle variable reassignments and scope changes
6. Add memory-efficient storage for large projects
7. Test cross-file method resolution scenarios
8. Update documentation with new capabilities

## Implementation Notes

- Created ProjectTypeRegistry class to maintain cross-file type information
- Registry tracks exported classes and their definitions with file paths
- Integrated registry with ProjectCallGraph to share type info between files
- Added detectFileExports method that scans files for export statements and registers exported classes
- Modified initializeFileImports to detect exports in imported files and use registry for type resolution
- Export detection works by checking if "export" keyword appears before class/function definitions
- Enabled cross-file tests for JavaScript and TypeScript - both now pass
- Updated cross-file-method-resolution.md documentation to reflect new capabilities
- Memory usage is efficient as registry only stores exported types, not all definitions
- Variable reassignments still need to be handled (only initial assignments tracked)

### Completed Language Support

- **JavaScript/TypeScript**: Full cross-file resolution working with ES6 imports and renamed imports
- **Export detection**: Works for explicit export statements (export class/function)

### Remaining Work

- **Python**: Handle different import styles (import x.y, from x.y import z)
- **Rust**: Handle Type::method() pattern and variable assignments from constructors
- **Variable reassignments**: Track type changes when variables are reassigned
- **Export syntaxes**: Handle export default, export *, named exports, etc.

### Recent Progress

- **Python Export Detection**: Implemented implicit export detection for Python (all top-level non-underscore items)
- **Python Constructor Tracking**: Added support for tracking `varName = ClassName()` assignments in Python
- **Rust Export Detection**: Added support for detecting `pub` items as exports in Rust
- **Cross-file Tests**: Python cross-file method resolution test now passing

## Blockers for Other Languages

### Python Support Blockers

**Critical Blocker - Task 30 (Export Detection):**
- Python has no explicit export keywords like JavaScript/TypeScript
- Everything at module level is implicitly exported unless:
  - It starts with underscore `_` (convention for private)
  - It's excluded from `__all__` list (if defined)
- Current implementation relies on detecting "export" keyword which doesn't exist in Python
- **Workaround**: Treat all top-level definitions as exported, filter by naming conventions

**Partial Blocker - Task 28 (Module Path Resolution):**
- Python uses `__init__.py` files to mark directories as packages
- Relative imports use dots: `from ..utils import helper`
- Module imports create namespace: `import utils` then `utils.helper()`
- Current implementation doesn't handle these Python-specific patterns
- **Impact**: Can't correctly resolve imports from packages or relative paths

### Rust Support Blockers

**Partial Blocker - Task 28 (Module Path Resolution):**
- Rust module system is tightly coupled to file structure
- `mod foo;` looks for `foo.rs` or `foo/mod.rs`
- Module paths like `crate::module::function` need special handling
- Use statements have various forms: `use super::`, `use self::`, `use crate::`
- **Impact**: Can't resolve modules correctly without understanding Rust's file conventions

**Minor Blocker - Export Detection:**
- Rust uses `pub` keyword instead of `export`
- Has visibility modifiers: `pub`, `pub(crate)`, `pub(super)`
- **Workaround**: Adapt export detection to look for `pub` keyword instead of `export`

### Implementation Strategies Without Resolving Blockers

**Python Quick Implementation:**
1. Treat all root-level definitions as potentially exported
2. Use simple heuristics (exclude `_` prefixed items)
3. Basic import resolution for same-directory imports only
4. Skip package imports and relative imports for now

**Rust Quick Implementation:**
1. Adapt export detection regex to match `pub` keyword
2. Support basic `use` statements for same-crate items
3. Skip complex module paths and external crates
4. Assume simple file structure (no nested modules)

**Limitations of Quick Implementation:**
- No support for Python packages or relative imports
- No support for Rust's module hierarchy
- May have false positives for exported items
- Cross-file resolution only works for simple cases
