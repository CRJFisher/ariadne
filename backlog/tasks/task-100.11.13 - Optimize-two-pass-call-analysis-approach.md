---
id: task-100.11.13
title: Optimize two-pass call analysis approach
status: To Do
assignee: []
created_date: '2025-08-04 16:44'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

The current call analysis uses a two-pass approach: first identifying constructor calls and type discoveries, then resolving all references. This could be optimized to a single pass or made more efficient. The current implementation works but may have performance implications for large codebases.

## Acceptance Criteria

- [ ] Call analysis performance is improved
- [ ] Type discoveries are efficiently tracked during analysis
- [ ] The optimization maintains correctness of results
- [ ] Performance benchmarks show improvement
