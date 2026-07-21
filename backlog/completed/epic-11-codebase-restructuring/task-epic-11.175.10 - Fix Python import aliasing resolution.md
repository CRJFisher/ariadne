---
id: task-epic-11.175.10
title: Fix Python import aliasing resolution
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

When a module is imported with an alias (`import generate as predict_generate`), subsequent calls through the alias (`predict_generate.generate_batched_predictions()`) are not resolved back to the original function definition.

## Root Cause

The resolver does not track import aliases. When an alias is used in a call expression, the resolver cannot map the alias back to the original module name to find the function definition.

## Example

- `generate_batched_predictions` in generate.py:64
  - Import: `import generate as predict_generate`
  - Call: `predict_generate.generate_batched_predictions()`

## Acceptance Criteria

- [ ] Import aliases are tracked in the semantic index
- [ ] Calls using aliased module names are resolved to the original module's function definitions
- [ ] Tests cover simple aliases and chained aliases if applicable
