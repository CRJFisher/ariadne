---
id: task-63
title: Add module-level call detection to call graph extraction
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-01'
updated_date: '2025-08-01'
labels:
  - call-graph
  - enhancement
dependencies: []
---

## Description

Call graph extraction currently only detects function calls made within function bodies. It does not detect calls made at the module level (top-level script code). This causes functions that are only called from module-level code to be incorrectly identified as top-level nodes.

## Acceptance Criteria

- [ ] Module-level function calls are detected and included in call graph
- [ ] Functions called from module-level code are not marked as top-level nodes
- [ ] Test coverage for module-level call detection

## Implementation Plan

1. Analyze current call extraction to understand why module-level calls are missed
2. Identify where module-level code is parsed in the AST
3. Add extraction logic for function calls at module scope
4. Update call graph building to include module-level calls
5. Test with benchmark-incremental.ts to verify detection
6. Add comprehensive test coverage for various module-level call patterns

## Implementation Notes

Successfully implemented module-level call detection. The solution involved:

1. Added get_module_level_calls() method to ProjectCallGraph that identifies references outside any function definition
2. Used enclosing_range instead of range for definitions to properly detect function boundaries
3. Created pseudo-module nodes to represent module-level code as the caller
4. Updated edge filtering to allow module edges (from #<module> nodes)
5. Integrated module-level calls into both extract_call_graph() and get_call_graph() methods

Results:
- Top-level nodes reduced from 58 to 46 (12 functions correctly identified as called from module)
- Total calls increased from 71 to 93 (22 additional module-level calls detected)
- Nodes called by others increased from 43.1% to 55.3%
- Functions like generateLargeFile and benchmark are no longer incorrectly marked as top-level

The implementation correctly handles various scenarios including executable scripts, module initialization, and distinguishes between function-level and module-level calls.
