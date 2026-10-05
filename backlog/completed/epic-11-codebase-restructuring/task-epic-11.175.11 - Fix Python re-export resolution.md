---
id: task-epic-11.175.11
title: Fix Python re-export resolution
status: To Do
assignee: []
created_date: '2026-01-29'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-epic-11.175
---

## Description

When a function is defined in one module and re-exported through an intermediate module, callers that import from the intermediate module are not linked back to the original definition. The resolver fails to trace through the re-export chain.

## Root Cause

The resolver does not follow re-export chains. When module B re-exports a function from module A, and module C imports that function from module B, the call graph does not connect module C's call to module A's definition.

## Example

- `get_previous_6_full_retail_months` defined in `preprocess_data/retail_calendar.py`
- Re-exported via `planner_predictions_evaluation/retail_months.py`
- Callers importing from `retail_months.py` are not traced to the original definition

## Acceptance Criteria

- [ ] Re-exported functions are tracked through the export chain
- [ ] Calls to re-exported functions are resolved to the original definition
- [ ] Tests cover single-level and multi-level re-exports
- [ ] Consider performance implications of following re-export chains
