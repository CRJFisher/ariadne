---
id: TASK-409
title: Resolve receiver value sources once per binding instead of once per call site
status: To Do
assignee: []
created_date: "2026-10-17 21:01"
labels:
  - call-resolution
  - performance
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

Loading a project whose files make thousands of method calls through one binding spends most of its time in call resolution. lodash loads in 20.4 s with `test/test.js` indexed against 7.6 s without it; indexing the file accounts for about 5 s of that, on a worker. Most of the rest is the main thread resolving the receivers of the file's roughly 14,000 `_.method(...)` calls: 12.8 s in `resolve_calls_for_files`, 7 s of it in `resolve_method_call` → `resolve_held_type` → `binding_value`. Users waiting on `list_entrypoints` or a triage run pay that on every load of such a project.

## Root cause

`resolve_held_type` (`resolve_references/call_resolution/value_source.ts`) derives what a binding holds by walking its value sources recursively, from scratch for every call site. Every call through `_` re-derives what `_` holds, so the cost is the number of call sites times the depth of the binding's value-source chain. Nothing is memoised across calls within one resolution pass.

## Approach

Memoise a binding's held value for the duration of one resolution pass, keyed by binding id. Results computed while a cycle is being cut by `visited` depend on the entry point of the walk; either memoise only results reached without cutting a cycle, or compute the strongly connected value-source groups once. Confirm the call graph is unchanged on the triage corpus (identical nodes, edges and entry points) and record the lodash load time before and after.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Resolving a project resolves each binding's held value at most once per resolution pass
- [ ] #2 Call graphs on the triage corpus are identical before and after (nodes, edges, entry points)
- [ ] #3 lodash with test/test.js indexed loads in materially less than the 20.4 s measured on 2026-10-17
<!-- AC:END -->
