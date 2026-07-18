---
id: TASK-364.5
title: "De-duplicate the three byte-identical decorator handlers in capture_handlers.typescript.ts"
status: Done
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

- [x] A single implementation backs all three decorator capture names; no
      duplicated handler body remains.
- [x] All three capture names still dispatch and produce unchanged output
      (existing TS capture-handler tests green).
- [x] Registry stays an object literal; call-graph traceability preserved.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The TypeScript capture-handler registry carried three byte-identical decorator
handlers, one per capture name, so any change to decorator handling had to be
made three times and a reader had to diff the bodies to learn they were the
same. A single `handle_decorator` function now backs all three capture names.

The registry in
`packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.typescript.ts`
stays an object literal (`TYPESCRIPT_HANDLERS`), with `decorator.class`,
`decorator.method`, and `decorator.property` all mapping to the shared
function — the mapping is visible at the registry itself, preserving
call-graph traceability. `handle_decorator` is not exported: dispatch reaches
it only through the registry keys, and no external module imports the
individual handlers (only the registry object is imported elsewhere), so the
per-project export rule — export only what external modules use — applies.
The handler distinguishes nothing by capture name; the decorator's target
kind is discovered structurally by `find_decorator_target`, which is why one
body serves all three keys.

Behavior is unchanged and proven by execution: the TS capture-handler suites
(90 tests) and the full workspace suite pass, and an end-to-end
`build_index_single_file` run over a class carrying `@Component` (class),
`@HostListener` (method), and `@Input` (property) decorators attaches all
three decorators to their definitions. Three read-only reviewers
(correctness-behavioral, completeness-vs-spec, adversarial cold-read)
returned no actionable findings; dispatch is purely key-based, so three keys
sharing one function object is behaviorally invisible.

Worth knowing: `capture_handlers.python.ts` keeps four near-identical
decorator handlers of its own (`handle_decorator_variable/function/property/method`);
collapsing those is a separate candidate task, out of scope here.
