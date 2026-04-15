---
id: TASK-190.15.10
title: Run self-healing pipeline on prisma/prisma (TypeScript)
status: To Do
assignee: []
created_date: '2026-04-15 21:55'
labels:
  - typescript
  - integration-test
dependencies: []
parent_task_id: TASK-190.15
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Repo**: prisma/prisma (~45k stars, ~69% TS)

**Why**: Sophisticated generated client type system. Conditional types (`IsKnownRequest`), mapped types for select/include/where builders, template literal types, recursive generic types for nested relations, `Partial`/`Pick`/`Omit` pushed to limits, inferred return types that change by query shape.

**Run**: `/self-repair-pipeline prisma/prisma`

Record any false positives, parse errors, or pipeline crashes.
<!-- SECTION:DESCRIPTION:END -->
