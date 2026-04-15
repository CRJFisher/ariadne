---
id: TASK-190.15.11
title: Run self-healing pipeline on django/django (Python)
status: To Do
assignee: []
created_date: '2026-04-15 21:55'
labels:
  - python
  - integration-test
dependencies: []
parent_task_id: TASK-190.15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Repo**: django/django (~87k stars, ~97% Python)

**Why**: `ModelBase` metaclass inspects class bodies to build field registries, custom descriptors for field access, `__dunder__` methods (`__get__`, `__set__`, `__init_subclass__`), class-based views with deep inheritance, decorators for routing/permissions/caching, `transaction.atomic` context managers. ~300k+ lines, dates to 2005.

**Run**: `/self-repair-pipeline django/django`

Record any false positives, parse errors, or pipeline crashes.
<!-- SECTION:DESCRIPTION:END -->
