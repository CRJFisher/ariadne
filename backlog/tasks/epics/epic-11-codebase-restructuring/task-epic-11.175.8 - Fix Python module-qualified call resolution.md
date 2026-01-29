---
id: task-epic-11.175.8
title: Fix Python module-qualified call resolution
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

The call graph resolver fails to trace Python module-qualified function calls where a module is imported and functions are invoked via dot notation (e.g., `import report_links` followed by `report_links.build_brand_month_mstyles_accuracy_report_links()`). The semantic registry does not properly link these attribute-access call patterns back to the function definitions in the imported module.

## Root Cause

When a module is imported directly (not `from X import Y`), calls to functions in that module use attribute access syntax. The current resolver does not trace `module.function()` calls back to the function definition in the imported module.

## Examples

- `train` in pipeline.py:55
- `evaluate_and_aggregate_projections_group` in evaluate_projections.py:37

## Acceptance Criteria

- [ ] Module-qualified calls like `report_links.build_brand_month_mstyles_accuracy_report_links()` are resolved to the function definition in the `report_links` module
- [ ] The call graph correctly traces these calls as callers of the target function
- [ ] Tests cover both simple module imports and nested module imports
