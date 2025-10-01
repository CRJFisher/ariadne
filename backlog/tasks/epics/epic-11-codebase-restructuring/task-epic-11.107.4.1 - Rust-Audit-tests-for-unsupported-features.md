---
id: task-epic-11.107.4.1
title: 'Rust: Audit tests for unsupported features'
status: To Do
assignee: []
created_date: '2025-10-01 10:28'
labels: []
dependencies: []
parent_task_id: task-epic-11.107.4
priority: high
---

## Description

Review semantic_index.rust.test.ts to identify and remove tests for:
- TYPE_PARAMETER, TYPE_CONSTRAINT (we don't extract these)
- Advanced lifetime tracking
- Macro expansion
- Complex trait bounds
- Const generics edge cases

FOCUS ON:
- Structs and enums (as classes)
- Traits (as interfaces)
- Impl blocks (methods)
- Functions
- Basic ownership patterns (& references)
