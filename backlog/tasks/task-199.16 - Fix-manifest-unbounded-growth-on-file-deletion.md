---
id: TASK-199.16
title: "Fix: manifest grows unboundedly when files are deleted"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - bugfix
  - persistence
dependencies: []
references:
  - packages/core/src/persistence/persistence.ts
  - packages/core/src/project/load_project.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

When source files are deleted from a project, their entries remain in the persisted manifest indefinitely. Over time this causes the manifest to grow without bound, consuming disk space and slowing manifest reads.

Discovered during task-199.9 review.

### Actions

1. Identify where the manifest is written (likely `save_project` or `FileSystemStorage`)
2. Add a cleanup step: after resolving which files exist, remove manifest entries whose file paths no longer exist on disk
3. Add an integration test: cold-load a project, persist, delete a file, warm-load, verify the deleted file's entry is absent from the new manifest
<!-- SECTION:DESCRIPTION:END -->
