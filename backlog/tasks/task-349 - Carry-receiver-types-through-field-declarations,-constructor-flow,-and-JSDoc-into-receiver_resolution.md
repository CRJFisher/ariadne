---
id: TASK-349
title: "Carry receiver types through field declarations, constructor flow, and JSDoc into receiver_resolution"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
priority: high
plan_dedup_key: dc80bdf53c0f162e1cd0b07335bdaa7b2ac23b0c3b29803f7cf28762fc8fcdeb
plan_source_task: pt-4bab06ce92cb530a
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

Every confirmed member of this bucket fails in `resolve_receiver_type` (`packages/core/src/resolve_references/call_resolution/receiver_resolution.ts`) with `stage: receiver_resolution / reason: method_not_on_type` (or, for webpack, surfaces as `no-textual-callers` for the same underlying reason). The resolver knows how to:

- resolve a `this`/`self` keyword base to the enclosing class type (`resolve_keyword_base`), and
- read an _explicit, same-language type annotation_ off a variable/parameter/property via `def.type` resolved in `def.defining_scope_id` (`resolve_identifier_base`, `walk_property_chain`), and
- bind a constructor return type _at the assignment location_ (`type_preprocessing/constructor.ts` + `bindings.ts`).

The bucket is the set of receiver shapes those three capabilities do **not** reach. They cluster into three structural gaps in how a receiver type is _propagated_ before `walk_property_chain` runs:

1. **`this.<field>.method()` where `<field>` has a declared class type.** The nest, prisma, celery, sqlalchemy members all dispatch off a class field (`this.config: ApplicationConfig`, `this.previous: MergedExtensionsListNode`, `this.result_consumer`, `this._dbapi_connection`). `walk_property_chain` _should_ handle these via `get_type_member` + `def.type` resolution, but the field declarations are not landing the type into the registry, so the chain hop returns `method_not_on_type`.
2. **Constructor return type that must flow across statements/method boundaries to an instance attribute.** The pandas members assign `self.df = pd.DataFrame(...)` (or a module-qualified constructor) in `setup()` and call methods on `self.df` in a _different_ method. Constructor binding is location-scoped, so the receiver type is lost the moment it is stored on `self.<attr>` and read elsewhere.
3. **JSDoc-typed receivers in plain JavaScript.** All 11 webpack members are `@param {ModuleGraph}` / `@param {Compilation}` / JSDoc-typed parameters and destructured locals; `bindings.ts` reads only structured `def.type` annotations, never JSDoc comment types, so the receiver has no type to walk.

## Architectural upgrade

Close the propagation gaps feeding `resolve_receiver_type`: (a) make declared class-field types reliably available to `walk_property_chain`, (b) propagate constructor and annotated types from a definition to the instance attribute / local it is stored on so the type survives across statements and method boundaries, and (c) extract JSDoc receiver types in JavaScript so `def.type` is populated for JSDoc-annotated params and locals. The localized fixes below carve this into independently-shippable resolver work, fronted by an interim classifier that suppresses the false-positives while the core work lands.

## Observations

- Observed count: **34**
- Projects: `celery`, `django`, `nest`, `pandas`, `prisma`, `sqlalchemy`, `tokio`, `webpack`
- Source runs: `5843d51-2026-06-18T17-43-39.783Z`, `66e2912-2026-06-22T15-23-50.566Z`, `897eeef-2026-06-22T11-45-34.787Z`, `918cf5d-2026-06-18T18-24-18.006Z`, `aa0efc9-2026-06-18T18-25-42.253Z`, `aef7f13-2026-06-22T10-38-14.644Z`, `ddf3b65-2026-06-22T10-58-10.555Z`, `f960917-2026-06-17T13-51-36.775Z`

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
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/eval.py:56` — Real caller exists: `self.df.query(...)` is called three times, with `self.df` assigned from `pd.DataFrame(...)` constructor, but Ariadne cannot resolve the instance attribute's type to link the call to `DataFrame.query`. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_methods.py:452` — Real caller exists: self.df is a DataFrame instance (assigned from constructor) and first_valid_index() is called on it, but Ariadne cannot carry the constructor's return type to resolve to the NDFrame base-class definition. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/frame_methods.py:865` — Real caller exists calling last_valid_index() on self.df (a DataFrame instance attribute), but resolution_count=0 because Ariadne cannot infer the type of self.df across the setup/time_last_valid_index method boundary. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/io/hdf.py:126` — Real caller assigns self.df from DataFrame constructor and calls to_hdf on it, but Ariadne fails to propagate the constructor's return type to the instance attribute. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/io/style.py:86` — Real caller exists: self.st.hide() is called on a Styler instance attribute but resolution_count=0 because Ariadne cannot trace the type of self.st assigned from a property access. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/asv_bench/benchmarks/stat_ops.py:165` — Real call to Series.cov on a pd.Series instance; Ariadne fails to link this because receiver type is lost after module-qualified constructor assignment. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/core/indexing.py:3171` — Real caller in \_ScalarAccessIndexer.**setitem**; self.obj is typed as Cython `object` (no annotation), preventing method dispatch resolution. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/arrays/categorical/test_api.py:387` — Direct call to Categorical.describe() on a variable assigned from a Categorical() constructor, which Ariadne fails to resolve to the definition at categorical.py:2731. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/extension/base/methods.py:594` — df is explicitly assigned from pd.DataFrame(...) at line 593, then df.diff(periods) is called at line 594, but this call is not resolved to DataFrame.diff because Ariadne cannot track the return type of the pd.DataFrame constructor. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/extensions/applyQueryExtensions.ts:62` — Real caller invokes getAllQueryCallbacks on client.\_extensions (typed as MergedExtensionsList) but Ariadne cannot resolve the property's declared type to link to the method at MergedExtensionsList:158. (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/extensions/MergedExtensionsList.ts:15` — Direct call to getAllClientExtensions() on this.previous (typed MergedExtensionsListNode) via optional chaining; the receiver type is statically known but Ariadne did not resolve the call (resolution_count=0). (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/extensions/MergedExtensionsList.ts:25` — Real caller: `this.previous` is typed as `MergedExtensionsListNode` and its `getAllBatchQueryCallbacks()` call at line 25 directly targets the entry at line 112, but Ariadne's resolver left this unresolved (resolution_count=0). (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/prisma--prisma/packages/client/src/runtime/core/model/applyModel.ts:43` — Real caller invokes getAllModelExtensions on a typed MergedExtensionsList instance field, but Ariadne reports resolution_count=0 for this call site. (project `prisma`, run `918cf5d-2026-06-18T18-24-18.006Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/dialects/oracle/oracledb.py:883` — Real caller exists at line 883 in create_server_side_cursor, calling ss_cursor on \_dbapi_connection whose type Ariadne cannot resolve through the instance attribute chain. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio-util/src/time/delay_queue.rs:669` — The `[]` index operator at line 669 and multiple other sites in delay_queue.rs desugars to calls to `SlabStorage<T>`'s `Index<Key>::index` method, but Ariadne does not link operator-syntax indexing to the trait `index` method implementation. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:1389` — Real caller invoking the method on a named ChunkGraph instance variable — three call sites exist in buildChunkGraph.js (lines 624, 666, 1389) but none were resolved by Ariadne. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:1413` — Direct method call on a `chunkGraph` local variable obtained via `const { chunkGraph } = compilation`, which Ariadne fails to type-resolve to the `ChunkGraph` class. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:148` — Direct call to getParentBlockIndex on a ModuleGraph-typed function parameter — a real caller that grep confirms but Ariadne's resolver missed. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:486` — chunkGroup.getNumberOfParents() is called here (and at line 1408) on a ChunkGroup instance from a for-of destructuring, but Ariadne produced no call references to ChunkGroup.getNumberOfParents. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:691` — Direct call to `compilation.addChunkInGroup(...)` where `compilation` is a JSDoc-typed `{Compilation}` parameter — a real caller that Ariadne's resolver did not link. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:956` — Direct call to getModulePreOrderIndex on a ChunkGroup instance variable, not resolved by Ariadne's call graph. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:958` — Real caller at line 958 and 1309 calls setModulePreOrderIndex on a ChunkGroup instance variable that Ariadne did not resolve. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:965` — Direct call to setPreOrderIndexIfUnset on a ModuleGraph-typed variable, confirming a real caller that Ariadne's resolver missed. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:989` — Direct call to setModulePostOrderIndex on a JSDoc-typed ChunkGroup receiver variable with no dynamic dispatch. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/webpack--webpack/lib/buildChunkGraph.js:996` — Direct method call on a JSDoc-typed ModuleGraph parameter; grep confirms the text exists but Ariadne produced no call reference. (project `webpack`, run `f960917-2026-06-17T13-51-36.775Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts` so the receiver_type_inference pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
