---
id: TASK-349.1.1
title: "[receiver_type_inference] Resolve method dispatch on declared-class-typed instance fields (this.<field>.method())"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-349.1
priority: high
ordinal: 1000
plan_dedup_key: 8370504f71a1a34c72c3043d1e6662a010a81ed30c83acaa086c53af8758de8c
plan_source_task: pt-4c00be799e3cf8d2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Members

nest `ApplicationConfig` fields (`getGlobalPipes`, `getGlobalInterceptors`, `getGlobalGuards`, `getGlobalRequestInterceptors`, `getGlobalRequestPipes`, `getGlobalRequestGuards`), nest `TestingInjector.setMocker`, prisma `MergedExtensionsList(Node)` methods, celery `self.result_consumer._wait_for_pending`, sqlalchemy `self._dbapi_connection.ss_cursor`.

## Fix

These receivers are `this.<field>` (or `obj.<field>`) where `<field>` carries a declared class/interface type — `private readonly config?: ApplicationConfig`, `this.previous: MergedExtensionsListNode`. `walk_property_chain` already attempts `get_type_member` then `def.type` resolution for `property` kinds, so the gap is upstream: the field's declared type is not reaching the registry (optional `?` fields, generic-erased declarations, and `readonly` modifiers are the recurring shapes in the evidence). The fix lands in the type-binding feeder (`type_preprocessing/bindings.ts` / `member.ts`) and the property-chain hop in `receiver_resolution.ts`: ensure a class-field declaration's annotated type is indexed and resolvable so the chain hop yields the field's type instead of `method_not_on_type`.

## Observations

- Observed count: **14**
- Projects: `celery`, `django`, `nest`, `prisma`, `tokio`
- Source runs: `5843d51-2026-06-18T17-43-39.783Z`, `66e2912-2026-06-22T15-23-50.566Z`, `918cf5d-2026-06-18T18-24-18.006Z`, `aa0efc9-2026-06-18T18-25-42.253Z`, `aef7f13-2026-06-22T10-38-14.644Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/celery/backends/asynchronous.py:305` — Direct call to `BaseResultConsumer._wait_for_pending` via the `self.result_consumer` attribute with resolution_count=0, confirming Ariadne failed to track the attribute type. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/django--django/django/contrib/gis/geos/geometry.py:772` — Real caller invokes OGRGeometry.from_json via a module-qualified two-level attribute chain that Ariadne cannot resolve. (project `django`, run `aa0efc9-2026-06-18T18-25-42.253Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/guards/guards-context-creator.ts:102` — Direct call to getGlobalGuards() on this.config typed as ApplicationConfig (optional) — real caller exists but resolution_count=0 because the resolver does not handle optional-typed class field method dispatch. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/guards/guards-context-creator.ts:107` — Direct call on `this.config` (typed ApplicationConfig) at line 107, unresolved by Ariadne despite the concrete class type being importable from '../application-config'. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/interceptors/interceptors-context-creator.ts:104` — Direct method call on `this.config` typed as optional `ApplicationConfig` — a real caller that resolution failed to link to the definition. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/interceptors/interceptors-context-creator.ts:109` — Direct method call on `this.config` which is declared as `private readonly config?: ApplicationConfig` at line 16, but Ariadne did not resolve this to `ApplicationConfig.getGlobalRequestInterceptors`. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/pipes/pipes-context-creator.ts:94` — Real caller `getGlobalMetadata` calls `this.config.getGlobalPipes()` where `this.config` is typed as `ApplicationConfig`, the class that owns `getGlobalPipes`. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/core/pipes/pipes-context-creator.ts:99` — Direct method call on a concrete-typed optional field (`private readonly config?: ApplicationConfig`) that Ariadne resolved with resolution_count=0. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/nestjs--nest/packages/testing/testing-instance-loader.ts:12` — Direct typed method call on this.injector (TestingInjector) that Ariadne failed to resolve due to generic type parameter erasure in the class declaration. (project `nest`, run `5843d51-2026-06-18T17-43-39.783Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/extensions/applyQueryExtensions.ts:62` — Real caller invokes getAllQueryCallbacks on client.\_extensions (typed as MergedExtensionsList) but Ariadne cannot resolve the property's declared type to link to the method at MergedExtensionsList:158. (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/extensions/MergedExtensionsList.ts:15` — Direct call to getAllClientExtensions() on this.previous (typed MergedExtensionsListNode) via optional chaining; the receiver type is statically known but Ariadne did not resolve the call (resolution_count=0). (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/extensions/MergedExtensionsList.ts:25` — Real caller: `this.previous` is typed as `MergedExtensionsListNode` and its `getAllBatchQueryCallbacks()` call at line 25 directly targets the entry at line 112, but Ariadne's resolver left this unresolved (resolution_count=0). (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/model/applyModel.ts:43` — Real caller invokes getAllModelExtensions on a typed MergedExtensionsList instance field, but Ariadne reports resolution_count=0 for this call site. (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/time/delay_queue.rs:669` — The `[]` index operator at line 669 and multiple other sites in delay_queue.rs desugars to calls to `SlabStorage<T>`'s `Index<Key>::index` method, but Ariadne does not link operator-syntax indexing to the trait `index` method implementation. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts` so the receiver_type_inference pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
