---
id: task-epic-11.175.9
title: Add Python pickle protocol method detection
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

The `__getstate__` and `__setstate__` methods are Python pickle protocol magic methods that are invoked implicitly by the pickle module during serialization/deserialization via reflection, not through direct code calls. Static analysis cannot detect these implicit callers without specific pickle protocol awareness.

## Root Cause

These methods are framework-invoked via reflection by Python's pickle module. They should be filtered out as framework-invoked methods, similar to how we handle other dunder methods that are implicitly called by the Python runtime.

## Examples

- `__setstate__` in model_config.py:52
- `__getstate__` in model_config.py:141

## Acceptance Criteria

- [ ] `__getstate__` and `__setstate__` are recognized as pickle protocol methods
- [ ] These methods are filtered from false positive entry point detection
- [ ] Documentation explains the rationale for filtering pickle protocol methods
- [ ] Consider whether other pickle protocol methods (`__reduce__`, `__reduce_ex__`, `__getnewargs__`, `__getnewargs_ex__`) should also be filtered
