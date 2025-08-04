---
id: task-100.12
title: Refactor Project class to be immutable with pluggable storage
status: To Do
assignee: []
created_date: '2025-08-04 22:39'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The Project class in index.ts has grown too large and contains mutable state. This epic will refactor it into an immutable architecture with separate concerns and pluggable storage backends. This will reduce file size, improve testability, and enable non-volatile storage options like SQLite.

## Acceptance Criteria

- [ ] index.ts is split into smaller modules
- [ ] Project class is immutable
- [ ] Storage interface is implemented
- [ ] All mutations go through storage layer
- [ ] Existing API compatibility maintained
