---
id: task-99
title: Complete remaining JavaScript test updates for ref_to_scope changes
status: To Do
assignee: []
created_date: '2025-08-04'
updated_date: '2025-08-04 13:29'
labels: []
dependencies:
  - task-97
---

## Description

After implementing ref_to_scope edges (task-97), 6 JavaScript tests still need their expectations updated to match the new behavior where references appear in their correct scopes instead of at root level.

## Acceptance Criteria

- [ ] ES6 import/export statements test updated and passing
- [ ] Classes and inheritance test updated and passing
- [ ] Destructuring and spread test updated and passing
- [ ] Loops and control flow test updated and passing
- [ ] JSX elements test updated and passing
- [ ] Closures and hoisting test updated and passing

## Implementation Plan

1. For each failing test, run it to see current vs expected output
2. Move references from root level to their proper containing scopes
3. Ensure built-in globals (console, window, etc.) appear where used
4. Verify each test passes after update

## Implementation Notes

This is a mechanical task following the pattern established in task-98. The ref_to_scope implementation is working correctly - these tests just need their expectations updated.

Moved to epic task-100.10 as part of validation accuracy improvements. Low priority test cleanup.
