---
id: task-100.44
title: Fix TypeScript TSX reference tracking
status: To Do
assignee: []
created_date: '2025-08-06 08:08'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

TSX files have issues with reference tracking, particularly around JSX elements and component references. The TypeScript parser may not be correctly handling TSX-specific syntax.

## Acceptance Criteria

- [ ] TSX component references are tracked
- [ ] JSX element usage is detected
- [ ] Props and state references work
- [ ] React hooks are tracked correctly
