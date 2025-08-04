---
id: task-100.11.13
title: Implement return type tracking for method chains
status: To Do
assignee: []
created_date: '2025-08-04 19:00'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Method call chains like `obj.getInner().process()` only detect the first call (getInner) but miss subsequent calls (process) because the system doesn't track method return types. This significantly impacts the nodes-called-by-others metric.

## Acceptance Criteria

- [ ] Method return types are tracked
- [ ] Chained method calls are fully resolved
- [ ] Test coverage for method chains
- [ ] Nodes-called-by-others percentage improves

## Implementation Plan

1. Add return type field to function definitions
2. Analyze function bodies to infer return types
3. Update method resolution to use return type info
4. Handle complex chains with multiple steps
5. Test with real-world patterns