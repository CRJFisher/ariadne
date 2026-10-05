---
id: task-84
title: Create generic validation script for external repositories
status: To Do
assignee: []
created_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

Create a generic version of validate-ariadne.ts that can validate call graph extraction for any repository in JavaScript/JSX/TSX, Python, or Rust. This will help validate cross-file method resolution works correctly in real-world codebases.

## Acceptance Criteria

- [ ] Generic validation script created
- [ ] Supports JS/JSX/TSX repositories
- [ ] Supports Python repositories
- [ ] Supports Rust repositories
- [ ] Can be run on any external repo path
- [ ] Provides same validation metrics as validate-ariadne.ts
