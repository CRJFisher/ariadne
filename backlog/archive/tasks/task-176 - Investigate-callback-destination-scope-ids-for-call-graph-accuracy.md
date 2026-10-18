---
id: task-176
title: Investigate callback destination scope-ids for call graph accuracy
status: To Do
assignee: []
created_date: '2026-01-29 14:36'
labels:
  - research
  - call-graph
dependencies: []
---

## Description

When building the call graph, callbacks currently use their defining_scope_id for invocation tracking. This creates false self-references when a callback's defining scope happens to be resolved to its own body scope. Investigate using 'destination scope-ids' for callbacks passed to local repo functions.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document the current callback scope behavior and its limitations
- [ ] #2 Prototype the destination scope-id approach on a small example
- [ ] #3 Identify all edge cases and document trade-offs
- [ ] #4 Recommend whether to proceed with implementation or keep the current filtering approach
<!-- AC:END -->
