---
id: task-100.11.11
title: Fix Rust-specific cross-file method resolution patterns
status: To Do
assignee: []
created_date: '2025-08-04 16:43'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Rust has specific patterns for method calls like Type::method() for associated functions and instance.method() for methods. The current implementation doesn't fully handle the Type::method() pattern in cross-file scenarios, particularly for imports using 'use crate::module::Type'.

## Acceptance Criteria

- [x] Rust Type::new() pattern is correctly resolved across files
- [x] Rust instance method calls work across files
- [x] Import resolution handles crate:: paths correctly
- [x] Tests for Rust cross-file method resolution pass

## Implementation Plan

1. Fix the import resolution for crate:: paths in virtual file system (done)
2. Ensure Type::new() calls are resolved correctly (done)
3. Track variable types from constructor calls (calc = Calculator::new()) (done)
4. Resolve instance method calls (calc.add(), calc.get_value()) (done)
5. Verify all tests pass (done)

## Implementation Notes

Fixed Rust-specific cross-file method resolution by addressing several issues:

1. **Import Resolution**: Fixed the crate:: path resolution in the virtual file system used by tests. Added fallback logic in Project.get_imports_with_definitions() to handle Rust's crate:: paths by checking multiple possible file paths (src/module.rs, src/module/mod.rs, and module.rs).

2. **Constructor Type Discovery**: The main issue was that for Rust's Type::new() pattern, the type discovery wasn't working because it was trying to resolve the constructor at the 'new' reference position instead of the Type position. Fixed by:
   - Storing the AST node for the type name when detecting Type::new() pattern
   - Using that node's position when resolving the constructor definition
   - Following imports if the initial resolution returns an import node

3. **Method Resolution**: The instance method calls (calc.add(), calc.get_value()) were already working once the type discovery was fixed. The existing resolve_method_call_pure function correctly uses the type information to find methods in the class/struct definition.

### Technical Details:
- Modified `analyze_constructor_call` in call_analysis.ts to handle Rust's Type::new() pattern better
- Added logic to store and use the type node position for constructor resolution
- Added import following logic when constructor resolution returns an import
- No changes were needed to the Rust scope queries - they were already correctly capturing method references

All Rust tests are now passing, including the cross-file method resolution test that was failing.
