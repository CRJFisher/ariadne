---
id: TASK-350.1.2
title: "[method_lookup] Follow re-export chains in namespace-export lookup"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-350.1
priority: high
ordinal: 2000
plan_dedup_key: 0234dc5e05cc1ed3eeee2b471d56c63cfae79da98efdcd47eb0806b05dca9380
plan_source_task: pt-d8b41077ec9d1017
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Members

TypeScript `import * as ts; ts.foo()` (and the `FourSlash.*` star-import) calls whose namespace branch resolves the source file but whose export is not found by `resolve_namespace_export`.

## Fix

In `resolve_namespace_export` (method_lookup.ts lines 324-338), when a direct `is_exported` definition for `export_name` is not found in the source file, follow the file's re-export edges (`export { foo } from './x'`, `export * from './x'`) to the terminal definition before returning null. Today the scan stops at the first file's direct definitions, so barrel-style re-exports — pervasive in the TypeScript compiler's `ts` namespace — never resolve.

Ground the linkage in the namespace branch at lines 48-69; the same fallback applies to the named/default-import submodule branch at lines 88-104.

## Observations

- Observed count: **10**
- Projects: `TypeScript`
- Source runs: `7964e22-2026-06-18T18-10-41.763Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/compiler/checker.ts:8638` — Direct call to getModuleSpecifiers via namespace import binding; resolution_count=0 confirms Ariadne failed to link namespace property access to the function definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/compilerImpl.ts:34` — Real caller uses `ts.readConfigFile` (namespace-qualified) with resolution_count=0, confirming Ariadne did not link this call to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/compilerImpl.ts:40` — Call is made as `ts.parseJsonConfigFileContent(...)` where `ts` is a namespace import (`import * as ts`), which Ariadne's resolver fails to follow. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/fourslashImpl.ts:349` — Real caller exists at this line using namespace-qualified `ts.convertCompilerOptionsFromJson` but resolution_count=0 because Ariadne does not follow namespace object member access to the exported function definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/fourslashImpl.ts:461` — Real caller exists at this line invoking getAllKeys via the `ts` namespace reference, but Ariadne's resolver failed to link it to the definition in core.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/harnessLanguageService.ts:463` — Real caller at line 463 invokes preProcessFile via the `ts` namespace alias with resolution_count=0, confirming a namespace-qualified dispatch resolution gap. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/harness/incrementalUtils.ts:161` — Real caller exists using namespace-qualified `ts.comparePathsCaseSensitive` but Ariadne's resolver reports resolution_count=0 due to inability to resolve through the `ts` namespace alias. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/testRunner/fourslashRunner.ts:59` — Real caller invokes runFourSlashTest via a star-import namespace alias FourSlash, which Ariadne's resolver did not link to the definition in fourslashImpl.ts. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/testRunner/unittests/config/showConfig.ts:29` — Real caller invokes getParsedCommandLineOfConfigFile via the ts namespace object with resolution_count=0, confirming Ariadne failed to link this namespace-qualified call to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/microsoft--TypeScript/src/tsc/tsc.ts:24` — Direct invocation of executeCommandLine via `ts.*` namespace import which Ariadne fails to resolve to the definition. (project `TypeScript`, run `7964e22-2026-06-18T18-10-41.763Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/method_lookup.ts` so the method_lookup pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
