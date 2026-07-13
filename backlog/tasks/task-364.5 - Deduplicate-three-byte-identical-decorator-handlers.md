---
id: TASK-364.5
title: "De-duplicate the three byte-identical decorator handlers in capture_handlers.typescript.ts"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - dead-code
  - refactor
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts`
has three decorator capture handlers whose bodies are byte-for-byte identical:

- `handle_decorator_class` (line 290)
- `handle_decorator_method` (line 308)
- `handle_decorator_property` (line 326)

They are **not** dead code — each is a distinct live dispatch target keyed on a
separate capture name (`decorator.class` / `decorator.method` /
`decorator.property`) in the handler registry. The `capture_handlers.typescript.ts`
sweep left them in place because collapsing them is a design change, not a
mechanical removal.

### Work

1. Collapse the three implementations to a single shared handler body while
   keeping all three capture names routing to it. Preferred: define one handler
   function and register it under the three capture-name keys in the registry
   object literal.
2. Preserve the registry's object-literal form and its call-graph traceability
   (the `HandlerRegistry` type is deliberately an object literal, not a `Map`,
   "to preserve call graph traceability" — do not regress that).
3. Confirm no behavioural difference: all three decorator captures still produce
   the same definitions as before.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A single implementation backs all three decorator capture names; no
      duplicated handler body remains.
- [ ] All three capture names still dispatch and produce unchanged output
      (existing TS capture-handler tests green).
- [ ] Registry stays an object literal; call-graph traceability preserved.

<!-- AC:END -->
