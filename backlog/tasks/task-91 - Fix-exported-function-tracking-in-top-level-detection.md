---
id: task-91
title: Fix exported function tracking in top-level detection
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Functions that are exported and used in other files are incorrectly marked as top-level. For example, get_symbol_id is exported from index.ts and used in scope_resolution.ts but still marked as top-level. The system needs to consider exports when determining top-level status.

## Acceptance Criteria

- [ ] Exported functions used elsewhere are not marked as top-level
- [ ] Top-level detection considers both internal calls and exports
- [ ] Only truly unused functions are marked as top-level

## Implementation Plan

1. Fix export detection in call graph nodes
2. Ensure exported status is properly tracked
3. Test with validation examples
4. Verify top-level detection accuracy

## Implementation Notes

Fixed export detection as part of the function counting fix (task-89).

### Problem
- All exported functions showed as not exported in call graph
- This affected top-level detection since export status wasn't considered

### Root Cause
- Export status was hardcoded to false in call graph node creation
- Line: `const is_exported = false;` in project_call_graph.ts

### Solution
1. Fixed export detection by using definition export status
2. Changed to: `const is_exported = func.is_exported || this.isDefinitionExported(file_path, func.name)`
3. Export status now properly propagates from definitions to call graph nodes

### Files Modified
- src/project_call_graph.ts: Fixed export detection in get_call_graph() at line 1171

### Test Results
- All exported functions now correctly marked as exported
- Export status available for top-level detection logic
- Functions like get_symbol_id now show is_exported=true

### Note
The actual top-level detection logic (considering exports) may need additional work beyond just tracking export status. The current fix ensures the export information is available for such logic.
