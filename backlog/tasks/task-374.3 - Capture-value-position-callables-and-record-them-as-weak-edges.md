---
id: TASK-374.3
title: "Capture value-position callables and record them as weak edges"
status: Done
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - syntactic_extraction
dependencies: []
parent_task_id: TASK-374
priority: high
ordinal: 3000
plan_dedup_keys:
  - b802599dbe375f62796addd10d2442ee54180444f793af705a98bf824030b3e5
plan_source_tasks:
  - pt-efc99c19af9b6d4a
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

A function handed to a framework by name — `app.get('/users', user.list)` — is never invoked at any syntactic call site, and no existing capture expresses it. `query_code_tree` mints references only for invocation and member-access positions, so the handler is unreferenced and `detect_entry_points` reports it as an entry point. This is the one genuinely new capture in the cluster; everything else in the group is shape completeness over existing captures.

## Work plan

1. **Add the reference kind.** Add `ReferenceKind.CALLABLE_VALUE` and a `CallableValueReference` (`{ kind, name, location, scope_id, property_chain }`) beside the existing reference unions in `packages/types` and in `index_single_file/references/factories.ts`. It is **not** a call kind — `build_call_reference` stays exhaustive over call kinds, exactly as the `property_access` branch documents at `call_resolver.ts:230-234`.
2. **Add the captures** in `queries/javascript.scm` and `queries/typescript.scm`: identifiers and member expressions in argument position — `(arguments [(identifier) (member_expression)] @reference.callable_value)` — the object-literal `(pair value: …)` form, and a named `function_expression` in argument position, which is how express installs `req.query` (`defineGetter(req, 'query', function query(){ … })`, `lib/request.js:230`).
3. **Map the capture** in `references/references.ts` to the new `CallableValueReference`, with its constructor in `factories.ts`.
4. **Resolve it.** Add a `case "callable_value"` to `call_resolution/call_resolver.ts` that resolves the name through `resolve_function_call` / `resolve_method_call`, keeps only targets whose definition kind is callable, and records a **weak** edge. Whether a value reference implies reachability is `classify_entry_points`' decision; the resolver only records the edge.
5. **Verify the consumers need no change.** `trace_call_graph/trace_call_graph.ts:73` (`get_all_referenced_symbols`) and `detect_entry_points` suppress the false positive through the existing path once a weak edge exists. Confirm the weak edge is not mistaken for a call edge by `trace_call_graph` consumers or by the triage evidence writer, and that `classify_entry_points` reads it as reachability evidence only.
6. **Add integration tests covering every evidence case.** In `Project` + `update_file` tests assert that `app.get('/users', user.list)` records a callable-value edge to `list` and that `list` is not an entry point; add the same assertion for the express `user.edit` and `post.list` route-handler rows (one per row, not a single representative); and assert that `defineGetter(req, 'query', function query(){ … })` records a callable-value edge to the named function expression so `test/req.query.js:102` clears. Add the object-literal `(pair value: …)` case. Assert a callable-value edge is _not_ minted for a non-callable argument. Update the JS/TS fixture corpora under `packages/core/tests/fixtures/{javascript,typescript}/code/` with these shapes and regenerate any affected index snapshots.
7. **Re-route the dynamic case:** `examples/mvc/lib/boot.js:67` (`obj[key]` from a `for…in`) is runtime-computed dispatch and belongs to the permanent-limitation leaf `pt-68bc4a8d3d965a2f`; record the re-route rather than attempting a capture for it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `ReferenceKind.CALLABLE_VALUE` and `CallableValueReference` exist in `packages/types` and `references/factories.ts`, and `build_call_reference` remains exhaustive over call kinds only.
- [x] #2 `app.get('/users', user.list)` records a weak callable-value edge to `list`, and the express `user.list`, `user.edit` and `post.list` false-positives each clear.
- [x] #3 `defineGetter(req, 'query', function query(){ … })` records a callable-value edge to the named function expression, clearing `test/req.query.js:102`.
- [~] #4 **Partial.** The member value position, the named-function-expression position and the non-callable-argument negative are each covered, and `callable_value.test.ts` pins the resolution branches directly. A *bare identifier* in object-literal value position deliberately mints no callable value: it already mints an identifier read that indirect reachability resolves, and a second capture recorded one reachability fact twice — verified equivalent at `Project` level. An ungrounded member chain mints nothing rather than resolving its trailing name lexically.
- [x] #5 The weak edge is consumed as reachability evidence only — `classify_entry_points` and the triage evidence writer do not treat it as a call edge.
- [x] #6 `examples/mvc/lib/boot.js:67` (`obj[key]` dynamic dispatch) is re-routed to `pt-68bc4a8d3d965a2f` with the reason recorded.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

A function handed to a framework by name — `app.get('/users', user.list)` —
is never invoked at any syntactic call site, so nothing referenced it and it
surfaced as an entry point. A `callable_value` reference now captures the
positions where that happens: member-expression arguments, object-literal
values, and a named function expression's own name node in argument position.
Bare identifier arguments deliberately have no new capture — the catch-all
identifier read plus `detect_indirect_reachability` already cover them, and a
capture there would double every identifier argument in every codebase.

The weak edge is the existing indirect-reachability channel, not a new edge
kind: `resolve_callable_values` (`call_resolution/callable_value.ts`) resolves
each reference — by exact location for a named function expression (its name
binds only inside its own body, so no name lookup can reach it), through the
method-call machinery for receiver chains, by name for the rest — keeps only
function/method targets, and merges the survivors into the resolution result's
`indirect_reachability` under the existing `function_reference` reason. Entry-
point detection already unions that map into its referenced set, so the false
positives clear with zero changes to `trace_call_graph`, `classify_entry_points`
or the triage evidence writer, and AC #5's "reachability evidence only, never a
call edge" holds by construction — `build_call_reference` remains exhaustive
over call kinds and a callable value never becomes a `CallReference`.

Because this family changes what an index contains, the persisted-cache schema
version advanced to 5; stale caches are discarded, not migrated.

## Re-route (AC #6)

`examples/mvc/lib/boot.js:67` reads `obj[key]` from a `for…in` loop —
runtime-computed dispatch no static capture can express. Re-routed to the
permanent-limitation leaf `pt-68bc4a8d3d965a2f`.

<!-- SECTION:NOTES:END -->
