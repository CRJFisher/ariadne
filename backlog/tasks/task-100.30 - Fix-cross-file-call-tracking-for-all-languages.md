---
id: task-100.30
title: Fix cross-file call tracking for all languages
status: To Do
assignee: []
created_date: '2025-08-05 22:38'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Cross-file method resolution is failing for JavaScript (CommonJS), TypeScript (ES6), Python, and Rust. Methods are incorrectly being marked as top-level nodes, and constructor calls are being included incorrectly in TypeScript.

## Acceptance Criteria

- [ ] JavaScript CommonJS tests pass
- [ ] TypeScript ES6 import tests pass
- [ ] Python import tests pass
- [ ] Rust use statement tests pass
- [ ] Methods called within modules are not marked as top-level
