---
id: task-76
title: Fix methods incorrectly appearing in top-level nodes
status: Done
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-04'
labels: []
dependencies: []
---

## Description

Some TypeScript and JavaScript cross-file resolution tests are failing because methods that should be filtered out are appearing in top-level nodes. This affects the call graph's identification of entry points.

## Acceptance Criteria

- [x] Methods called by other functions are not in top-level nodes
- [x] Private uncalled methods are filtered correctly
- [x] Top-level node detection works consistently across languages

## Implementation Notes

Resolved as part of the cross-file method resolution implementation. Top-level node detection now correctly filters out methods that are called by other functions.
