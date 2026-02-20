---
id: task-190.10
title: Add stale known-entrypoints verification
status: To Do
assignee: []
created_date: '2026-02-18 14:20'
labels: []
dependencies: []
parent_task_id: task-190
priority: medium
---

## Description

When entrypoints are removed from the codebase, known-entrypoints registry entries become stale. Add a verification step in the classification phase that checks whether all "known" entries still appear in the analysis output, and warns/removes entries that no longer match.

This prevents the registry from accumulating phantom entries over time, which would inflate the "known-tp" count and mask regressions.
