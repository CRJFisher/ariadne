---
id: TASK-190.15.13
title: Run self-healing pipeline on pandas-dev/pandas (Python)
status: To Do
assignee: []
created_date: '2026-04-15 21:56'
labels:
  - python
  - integration-test
dependencies: []
parent_task_id: TASK-190.15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Repo**: pandas-dev/pandas (~48k stars, ~75% Python)

**Why**: `CachedProperty` and accessor descriptors (`.str`, `.dt`, `.cat`), `__getitem__`/`__setitem__`/`__getattr__` overrides, complex class hierarchy (`DataFrame` → `NDFrame` → `PandasObject`), generators in iteration, `__slots__`, `@abstractmethod`, typing generics, `option_context` context managers. ~400k+ lines.

**Run**: `/self-repair-pipeline pandas-dev/pandas`

Record any false positives, parse errors, or pipeline crashes.
<!-- SECTION:DESCRIPTION:END -->
