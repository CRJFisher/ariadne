---
id: TASK-374.1
title: "Resolve CommonJS export status by scope, not by name, so shadowed locals stop aborting whole-file resolution"
status: Done
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - syntactic_extraction
dependencies: []
parent_task_id: TASK-374
priority: high
ordinal: 1000
plan_dedup_keys:
  - 4914418b7a272a5f2faee90b3bf52c2f5743c62b527757cceab7810c9430a0ce
plan_source_tasks:
  - pt-35786ed0bfe9d8c3
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`symbol_factories/exports.javascript.ts:342-361` looks CommonJS export status up by **name alone**. The upward walk at `exports.javascript.ts:320-338` correctly stops at a function-body boundary, then falls through to that name-keyed cache, which re-exports the function-local binding. A module-scope `var res = …` plus a function-local `var res = this;` therefore makes `ExportRegistry.update_file` throw `Duplicate export name "res"` (`registries/export.ts:150`), aborting resolution for the entire file. Reproduced in seven lines and reproduced verbatim on the real `expressjs--express/lib/response.js` (module-level `var res` at line 43, function-local `var res = this;` at line 376), which blanks resolution for that whole file and produces the `sendFile`, `append`, `location`, `sendfile` and `stringify` false-positives as one bug.

This is the smallest, highest-yield item in the cluster and lands **first**, so later measurements of the query changes are not taken through a crashed file.

## Work plan

1. In `extract_export_info` (`symbol_factories/exports.javascript.ts:302`), record whether the upward walk terminated at the function-body boundary (line 333).
2. When it did terminate there, return `{ is_exported: false }` immediately, without consulting the name-keyed cache at lines 342-361. A binding that lives inside a function body is never a CommonJS module export, whatever a same-named module-scope binding did.
3. Leave the module-scope path unchanged: bindings whose walk reaches module scope keep their existing export resolution.
4. Confirm `ExportRegistry.update_file` (`registries/export.ts:150`) no longer sees the duplicate name, and that its duplicate check still fires for genuine module-scope duplicates.
5. **Add integration tests covering every evidence case.** Add a `Project` + `update_file` test for the seven-line repro (module-level `var res = {}`, `module.exports = res`, and a method containing `var res = this;`) asserting the file indexes without throwing and that its calls resolve. Add a fixture under `packages/core/tests/fixtures/javascript/code/` mirroring the `expressjs--express/lib/response.js` shape (module-level `var res` at top, function-local `var res = this` inside a method, plus the five methods) and assert that `sendFile`, `append`, `location`, `sendfile` and `stringify` are each reachable — one assertion per evidence row, not a single representative.
6. Re-run the express portion of the triage evidence and confirm the five `lib/response.js` rows clear; the `webpack unpack` and `lodash updateLogRow` rows in the same leaf are out of scope (receiver typing and anonymous-callable scope construction respectively) and are re-routed, not fixed here.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A file with a module-scope `var res` and a function-local `var res = this;` indexes without throwing `Duplicate export name "res"`.
- [ ] #2 `ExportRegistry.update_file` still rejects genuine module-scope duplicate export names.
- [ ] #3 Integration tests (seven-line repro plus a `tests/fixtures/javascript/code/` fixture in the `expressjs--express/lib/response.js` shape) demonstrate all five evidence rows — `sendFile`, `append`, `location`, `sendfile`, `stringify` — resolve and are no longer entry-point false-positives.
- [ ] #4 The `webpack unpack` and `lodash updateLogRow` rows are explicitly re-routed (receiver typing; `scope_construction` anonymous-function body scope) rather than left silently open.
- [ ] #5 Existing JavaScript export and resolution suites stay green.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

A module-scope `var res` and a function-local `var res = this;` shared one
name-keyed export cache, so the local binding re-exported the module binding
and `ExportRegistry.update_file` aborted the whole file as a forged duplicate
export — blanking `expressjs--express/lib/response.js` and reporting its five
methods as entry points. Export status now follows scope: `extract_export_info`
returns unexported at the function-body boundary instead of falling through to
the name-keyed caches, and a block-scoped binding (`let`/`const`/class,
catch parameters, function-expression names) that crossed any block never
consults them either — only hoisted bindings (`var`, function declarations)
reach module scope from inside a block.

Clearing the file's crash exposed a second root cause for three of the five
evidence rows: a collection member implemented by a **named** function
expression (`res.sendFile = function sendFile(...)`) was registered under its
location-keyed anonymous twin, so `module.exports = res` marked the twin
reachable while the named definition dangled as an entry point.
`detect_member_assignment` now records the named function's own symbol as the
member identity, and collection-read reachability lands on the real
definition.

The fix lives in `query_code_tree/symbol_factories/exports.javascript.ts`
(scope walk) and `symbol_factories.javascript.ts` (`detect_member_assignment`);
the evidence tests live in `resolve_references.javascript.test.ts` (temp-dir
projects — fixture-path files are test-flagged and vacuously excluded from
entry points) with the corpus shape at
`tests/fixtures/javascript/code/integration/commonjs_response_object/`.

Verified on the real express corpus: `lib/response.js` indexes (zero dropped
files, was one), and `sendFile`, `append`, `location`, `sendfile` and
`stringify` are all off the entry-point list — `sendfile`/`stringify` through
resolved call edges, the three `this`-bound methods through `collection_read`
reachability.

## Re-routes (AC #4)

- `webpack unpack` — receiver typing: the reference exists; resolution fails on
  the receiver's type, which this task does not touch. Re-routed to
  `receiver_type_inference`.
- `lodash updateLogRow` — `scope_construction`: anonymous-callable body-scope
  construction, unrelated to export status. Re-routed to `scope_construction`.

<!-- SECTION:NOTES:END -->
