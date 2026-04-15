---
id: TASK-190.15.15
title: Run self-healing pipeline on celery/celery (Python)
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
**Repo**: celery/celery (~26k stars, ~98% Python)

**Why**: `@app.task` decorators, metaclasses for task class registration, `__reduce__` and pickle protocols, context managers for connection pooling, generators for result iteration, signals via descriptor-like patterns, dynamic imports, `__init_subclass__` for plugin registration. Sync and async execution backends. ~150k+ lines, founded 2009.

**Run**: `/self-repair-pipeline celery/celery`

Record any false positives, parse errors, or pipeline crashes.
<!-- SECTION:DESCRIPTION:END -->
