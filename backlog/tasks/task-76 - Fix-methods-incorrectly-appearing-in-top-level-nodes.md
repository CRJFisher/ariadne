---
id: task-76
title: Fix methods incorrectly appearing in top-level nodes
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Some TypeScript and JavaScript cross-file resolution tests are failing because methods that should be filtered out are appearing in top-level nodes. This affects the call graph's identification of entry points.

## Acceptance Criteria

- [ ] Methods called by other functions are not in top-level nodes
- [ ] Private uncalled methods are filtered correctly
- [ ] Top-level node detection works consistently across languages
