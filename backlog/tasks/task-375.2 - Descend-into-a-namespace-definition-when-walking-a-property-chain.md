---
id: TASK-375.2
title: "Descend into a namespace definition when walking a property chain"
status: Done
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - import_resolution
dependencies: []
parent_task_id: TASK-375
priority: high
ordinal: 2000
plan_dedup_keys:
  - 1cfeb44e7ff613e82fccc22f7bf467bf89996dda50e4e4ae6ba033baa038352a
plan_source_tasks:
  - pt-37a00049c62c5c07
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`walk_property_chain` (`call_resolution/receiver_resolution.ts:297-373`) resolves each hop through `types.get_type_member` / `definitions.get_member_index()`. A hop whose member is a TypeScript `export namespace` block resolves through neither and reproduces as `receiver_resolution/method_not_on_type` **even with no barrel in the chain** — `FindAllReferences.Core.getReferencesForFileName` is the corpus shape. This is the one genuinely separate resolver path in the epic: the parent task's wildcard fan-out does not touch it, and the `_namespaces` shape still fails with a _named_ leaf re-export.

The second half of this leaf's evidence — a re-exported namespace import losing its `export` metadata — is fixed in the parent task (`handle_definition_import` passing `extract_export_info`'s result into `builder.add_import`). This task adds the descent and proves both halves end to end.

## Work plan

1. In `walk_property_chain` (`receiver_resolution.ts:297-373`), add a branch: when the current hop is a `namespace` definition, look the next segment up in that namespace's own scope via `scopes.get_scope` + `definitions.get_scope_definitions`. Keep the existing `types.get_type_member` / `get_member_index()` attempts first so no current behaviour changes; the descent runs only where both miss.
2. Leave `resolve_identifier_base` (`receiver_resolution.ts:230`) untouched — recovered bindings from sub-task 1.1 flow into it unchanged.
3. Add `Project` + `update_file` integration tests covering **every** case in this leaf's triage evidence, each asserting `resolutions.length === 1`: `export namespace Core { export function f() {} }` reached directly (the `FindAllReferences.Core.getReferencesForFileName` shape); the same namespace reached through a barrel; `import { formatting } from './_namespaces/ts.js'` where the barrel does `import * as formatting …; export { formatting }` and the leaf does `export *`, then `formatting.formatOnSemicolon(...)`; the same shape with a _named_ leaf re-export instead of `export *`, which must pass on the metadata fix alone; and the three-chained-barrel `discoverTypings` shape crossing a wildcard hop, a namespace-object hop and a wildcard hop. Reuse the `_namespaces` barrel fixture directory added by the parent task.
4. Keep the `resolve_references.*.test.ts` namespace-import suites green — the descent must not shadow an existing type-member hit.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The four namespace-object member-access false-positives clear.
- [ ] #2 `export namespace Core { export function f() {} }` resolves when reached directly (the `FindAllReferences.Core.getReferencesForFileName` shape) with no barrel anywhere in the chain.
- [ ] #3 `import { formatting } from './_namespaces/ts.js'` followed by `formatting.formatOnSemicolon(...)` resolves for both a `export *` leaf and a named leaf re-export.
- [ ] #4 The three-chained-barrel `discoverTypings` shape resolves across a wildcard hop, a namespace-object hop and a wildcard hop.
- [ ] #5 Integration tests (using the `_namespaces` barrel fixture) cover each of these evidence cases individually, each asserting `resolutions.length === 1`.
- [ ] #6 The existing `resolve_references.*.test.ts` namespace-import suites stay green and no hop that previously resolved through `get_type_member` / `get_member_index()` changes target.

<!-- AC:END -->

## Implementation Notes

## High-level summary

A property chain can now cross a namespace. `walk_property_chain` resolved each hop through the type registry and the member index; a TypeScript `namespace` block appears in neither, because its members live in its own body scope, and a namespace *import* appears in neither either, because its members are the exports of the module it names. Both hops now resolve, and both are tried only where the existing two attempts miss, so no hop that previously resolved changes target.

Three pieces make the descent whole. A namespace is its own receiver, so `resolve_identifier_base` returns it as its type rather than failing with `receiver_type_unknown`. A hop that lands on a namespace or a namespace import descends into it, and a hop that lands on a named import is first dereferenced to what it names — the shape `import { FindAllReferences } from …; FindAllReferences.Core.f()` needs both. A namespace or import member is carried forward as the next hop's receiver, so chains of any depth walk. The terminal call resolves the same way: `method_lookup` gained the matching arm, sharing one helper with the chain walk so a hop and a call target descend alike.

A namespace's body scope is found by name — a `@scope.namespace` capture is stored with ScopeType `module` and keeps the declared name — rather than by comparing locations, which the boundary extractor is free to narrow.

Front door for readers: `receiver_resolution.ts` owns the descent (`resolve_namespace_member`, `resolve_namespace_scope_member`, `dereference_named_import`); `method_lookup.ts` calls the same helper for the terminal.

### Verification

`packages/core` 3609/3609 green; typecheck and lint clean. Four integration tests pin the evidence shapes individually, each asserting one resolution and the terminal definition's identity: a nested `export namespace` reached directly with no barrel; a barrel's namespace object over an `export *` leaf; the same over a named leaf re-export; and `ts.JsTyping.discoverTypings()` across a namespace import, a namespace-object hop and a wildcard hop. The existing `resolve_references.*.test.ts` namespace-import suites stay green.
