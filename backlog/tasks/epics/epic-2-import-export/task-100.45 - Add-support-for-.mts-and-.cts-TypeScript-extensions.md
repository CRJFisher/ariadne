---
id: task-100.45
title: Add support for .mts and .cts TypeScript extensions
status: To Do
assignee: []
created_date: '2025-08-06 08:08'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

New TypeScript module extensions (.mts for ES modules, .cts for CommonJS) are not currently supported. These extensions are increasingly common in modern TypeScript projects.

## Acceptance Criteria

- [ ] .mts files are parsed as TypeScript ES modules
- [ ] .cts files are parsed as TypeScript CommonJS
- [ ] Import resolution works for new extensions
- [ ] File type detection includes new extensions
