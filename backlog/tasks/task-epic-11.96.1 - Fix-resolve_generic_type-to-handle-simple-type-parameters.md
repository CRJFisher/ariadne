---
id: task-epic-11.96.1
title: Fix resolve_generic_type to handle simple type parameters
status: To Do
assignee: []
created_date: '2025-09-11 10:28'
labels: []
dependencies: []
parent_task_id: task-epic-11.96
---

## Description

The resolve_generic_type function in generic_resolution.ts doesn't properly resolve simple type parameters like 'T' when they don't have angle brackets or square brackets. This causes all tests to fail. The function should check if the type_ref is a type parameter in the context and resolve it even when it has no brackets.
