---
id: task-100.37
title: Fix Rust cross-file method resolution
status: Done
assignee: []
created_date: "2025-08-06 07:17"
updated_date: "2025-08-06 08:24"
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Rust method calls on imported structs are not being resolved correctly. While constructor calls (Logger::new) are detected, instance method calls (logger.log, logger.get_logs) are not being linked to their definitions in the imported module.

## Acceptance Criteria

- [x] Rust method calls resolve to imported struct methods
- [x] Cross-file test for Rust passes completely
- [x] Method calls don't appear in top-level nodes when called cross-file

## Implementation Notes

Successfully fixed Rust cross-file method resolution. The issue was twofold:

### Problem 1: Method Resolution for Rust impl blocks

In Rust, methods are defined in `impl` blocks separate from the struct definition. The method resolution was only looking for methods within the struct's range, which didn't include the impl block.

### Solution 1

Modified `resolve_method_call_pure` in `method_resolution.ts` to also check the symbol_id pattern for Rust. Now it looks for methods either:

- Within the class range (for most languages), OR
- With matching symbol_id pattern `file#ClassName.methodName` (for Rust impl blocks)

### Problem 2: Private Methods in Call Graph

Private Rust methods (without `pub` keyword) were appearing in the call graph even when never called.

### Solution 2

Added filtering in `build_call_graph_for_display` to remove private Rust methods that are never called from the graph.

### Technical Changes

1. **method_resolution.ts**: Enhanced method finding to check symbol_id pattern for Rust
2. **graph_builder.ts**: Added filter to remove uncalled private Rust methods

### Test Results

✅ All 5 cross-file tests now passing:

- JavaScript CommonJS
- TypeScript ES6
- Python
- Rust
- Mixed languages

The fix ensures Rust method calls on imported structs are properly resolved, matching the behavior of other languages.
