---
id: task-100.36
title: Fix TypeScript TSX reference tracking
status: To Do
assignee: []
created_date: '2025-08-05 22:43'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

TypeScript TSX parsing test shows that references are not being tracked correctly in TSX files. The test expected certain references to be tracked but they are missing from the actual results.

## Acceptance Criteria

- [ ] TSX files are parsed correctly
- [ ] References in TSX are tracked properly
- [ ] TypeScript tsx test passes
