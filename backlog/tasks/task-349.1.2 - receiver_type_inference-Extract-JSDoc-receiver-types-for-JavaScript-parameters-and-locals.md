---
id: TASK-349.1.2
title: "[receiver_type_inference] Extract JSDoc receiver types for JavaScript parameters and locals"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-349.1
priority: high
ordinal: 2000
plan_dedup_key: e840b97680b970a6f549daeffc2a838b13e4080c42c3abc6855dd5b40f6864ba
plan_source_task: pt-92b41982d2428b87
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Members

All 11 webpack members in `lib/buildChunkGraph.js`: methods on `@param {ModuleGraph}` / `@param {Compilation}` / `@param {ChunkGraph}` / `@param {ChunkGroup}` parameters and JSDoc-typed destructured locals (`setPreOrderIndexIfUnset`, `setPostOrderIndexIfUnset`, `addChunkInGroup`, `connectBlockAndChunkGroup`, `disconnectChunkGroup`, `getNumberOfParents`, `setModulePreOrderIndex`, `getModulePreOrderIndex`, `setModulePostOrderIndex`, `getParentBlockIndex`). These surface as `no-textual-callers` because the call references are produced but never resolve to a typed receiver.

## Fix

`type_preprocessing/bindings.ts` reads `def.type` only from structured language annotations; plain JavaScript carries its receiver types in JSDoc (`@param {ModuleGraph} compilation`, `@type {ChunkGraph}`). The fix extracts JSDoc type tags during JavaScript indexing and lands them as the `def.type` (or constructor binding) for the annotated parameter/local, so `resolve_identifier_base` can resolve the type name in the defining scope exactly as it does for TypeScript annotations. This is a JavaScript-specific extraction feeding the existing `def.type` resolution path; no change to the core walk is required.

## Observations

- Observed count: **11**
- Projects: `sqlalchemy`, `webpack`
- Source runs: `ddf3b65-2026-06-22T10-58-10.555Z`, `f960917-2026-06-17T13-51-36.775Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/dialects/oracle/oracledb.py:883` — Real caller exists at line 883 in create_server_side_cursor, calling ss_cursor on \_dbapi_connection whose type Ariadne cannot resolve through the instance attribute chain. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
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
