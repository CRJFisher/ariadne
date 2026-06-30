---
id: TASK-359
title: Capture decorator-factory invocation as a call reference
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - typescript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A decorator factory call — `@Decorator(args)` — invokes the factory function, but the
decorator query in `typescript.scm` (around lines 197–224) captures the name only as
`@decorator.class`, never as `@reference.call`. So a factory function referenced only
through a decorator has no inbound edge and looks unreachable.

Surfaced by TASK-190.30.1's registry audit, which removed the `ts-decorator-factory-call`
suppressor classifier as a fixable capture gap. Sibling of TASK-351 / TASK-358 — a
distinct reference-capture form in the same `.scm` file.

### Origin (deleted classifier row this tracks)

`ts-decorator-factory-call` (predicate; observed_count 0, but the gap is provable in
`typescript.scm` independent of a triage hit).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A `@Decorator(args)` decorator-factory call emits a `@reference.call` resolving to
      the factory function.
- [ ] A factory invoked only as a decorator is no longer an unreachable entry point.
- [ ] Regression test covers a decorator-factory-only invocation.

<!-- AC:END -->
