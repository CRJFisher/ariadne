---
id: task-100.11.11
title: Fix Rust-specific cross-file method resolution patterns
status: To Do
assignee: []
created_date: '2025-08-04 16:43'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Rust has specific patterns for method calls like Type::method() for associated functions and instance.method() for methods. The current implementation doesn't fully handle the Type::method() pattern in cross-file scenarios, particularly for imports using 'use crate::module::Type'.

## Acceptance Criteria

- [ ] Rust Type::new() pattern is correctly resolved across files
- [ ] Rust instance method calls work across files
- [ ] Import resolution handles crate:: paths correctly
- [ ] Tests for Rust cross-file method resolution pass
