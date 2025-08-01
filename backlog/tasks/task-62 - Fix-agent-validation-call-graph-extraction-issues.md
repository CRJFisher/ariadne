---
id: task-62
title: Fix agent validation call graph extraction issues
status: To Do
assignee: []
created_date: '2025-08-01'
labels:
  - bug
  - validation
  - call-graph
dependencies:
  - task-61
---

## Description

The agent validation framework reveals that Ariadne's call graph extraction is not working correctly when analyzing its own codebase. No function calls are being detected, metadata is missing, and top-level node identification is incorrect.

## Acceptance Criteria

- [ ] Call relationships are correctly extracted and shown in output
- [ ] Line numbers and source snippets are populated
- [ ] Top-level nodes correctly exclude functions called within the same module
- [ ] File summary shows individual file statistics
- [ ] Agent validation report shows >85% accuracy
