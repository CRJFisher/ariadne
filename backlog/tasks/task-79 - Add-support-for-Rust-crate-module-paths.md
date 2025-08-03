---
id: task-79
title: 'Add support for Rust crate:: module paths'
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Rust module resolution currently doesn't handle crate:: prefixed paths correctly. This is needed for proper module resolution in Rust projects that use crate-relative imports.

## Acceptance Criteria

- [ ] crate:: paths resolve correctly
- [ ] Module resolution works for all Rust import styles
- [ ] Tests cover crate:: path resolution
