---
id: task-epic-11.175.12
title: Fix duplicate module/function name collision
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

When multiple modules or functions share the same name, the call graph resolver incorrectly matches calls to the wrong definition. This can occur with identically-named modules in different packages or identically-named functions in different files.

## Root Cause

The resolver may use only the function/module name without full path qualification, leading to ambiguous matches when the same name exists in multiple locations.

## Examples

- `get_timestep_weighted_accuracies` - two `weighted_mape.py` files in different packages
- `update_all` - two functions with the same name in different files

## Acceptance Criteria

- [ ] Function resolution uses fully qualified paths (package + module + function name)
- [ ] When multiple definitions exist with the same name, the correct one is selected based on import context
- [ ] Tests cover same-named functions in different modules
- [ ] Tests cover same-named modules in different packages
- [ ] Error handling for truly ambiguous cases where resolution is not possible
