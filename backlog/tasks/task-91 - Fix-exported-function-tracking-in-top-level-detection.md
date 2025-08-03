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

## Implementation Notes

Test cases from validation:
- get_symbol_id: Exported from index.ts:23 and called from scope_resolution.ts:355 but marked as top-level
- extract_class_relationships: Exported and called from index.ts and project_inheritance.ts:58 but marked as top-level

These functions are exported from one module and imported/used in another, but the system doesn't track this as a 'call' relationship. Need to consider re-exports and module boundaries.
