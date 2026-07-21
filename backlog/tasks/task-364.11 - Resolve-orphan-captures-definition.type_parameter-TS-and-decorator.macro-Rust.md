---
id: TASK-364.11
title: >-
  Resolve orphan captures: definition.type_parameter (TS) and decorator.macro
  (Rust)
status: To Do
assignee: []
created_date: '2026-07-21 09:37'
labels:
  - dead-code
  - tooling
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/rust.scm
  - .claude/hooks/capture_receiver_consistency.ts
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two capture/receiver orphans surfaced by TASK-364.10 remain: `typescript.scm` emits `@definition.type_parameter` and `rust.scm` emits `@decorator.macro`, but neither has a handler in the matching `capture_handlers.<lang>.ts` registry. Because definitions dispatch by exact `registry[capture.name]` lookup, these captures are silently dropped — the extraction the query author intended never runs.

The consistency Stop hook (`.claude/hooks/capture_receiver_consistency_stop.ts`) warns on these; they are pinned by the integration test in `.claude/hooks/capture_receiver_consistency.test.ts` ("reports exactly the two known orphan captures").

Decide per capture whether the extraction is wanted:

- If wanted: add the handler to the matching registry (and cover it with a test). `@definition.type_parameter` is listed as a valid optional capture in `queries/CAPTURE-SCHEMA.md`; `@decorator.macro` is not in the schema and would need adding.
- If not wanted: drop the capture from the `.scm` query (and, for `definition.type_parameter`, its schema entry) so nothing emits an unhandled capture.

When resolved, update the pinned-orphan assertion in the consistency test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of @definition.type_parameter and @decorator.macro either gains a handler (with a test) or is removed from its query and schema
- [ ] #2 The capture/receiver consistency check reports zero orphan captures
- [ ] #3 The pinned-orphan assertion in capture_receiver_consistency.test.ts is updated to match; core suite, typecheck, lint green
<!-- AC:END -->
