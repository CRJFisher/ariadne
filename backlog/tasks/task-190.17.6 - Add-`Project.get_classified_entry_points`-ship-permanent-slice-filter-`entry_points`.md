---
id: TASK-190.17.6
title: >-
  Add `Project.get_classified_entry_points()`; ship permanent slice; filter
  `entry_points`
status: To Do
assignee: []
created_date: "2026-04-28 19:15"
updated_date: "2026-04-28 21:27"
labels:
  - self-repair
  - core-refactor
  - api-breaking
dependencies:
  - TASK-190.17.5
parent_task_id: TASK-190.17
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

The user-visible benefit lands here. Three changes:

1. Generate `packages/core/src/classify_entry_points/registry.permanent.json` from the skill's full registry, filtered to `status: "permanent" && classifier.kind !== "none"`. Bundle it in core's `dist/` like the existing tree-sitter `.scm` queries (`packages/core/src/index_single_file/query_code_tree/queries/`).
2. Delete `packages/core/src/trace_call_graph/filter_entry_points.python.ts` and add the dunder rule as a `permanent` registry entry (`group_id: "py-dunder-protocol"`). Surfaces as `kind: "dunder_protocol"`.
3. Add `Project.get_classified_entry_points()` API; `Project.get_call_graph().entry_points` filters to true positives only.

## API additions

```ts
// packages/types/src/call_chains.ts (additions)
export type EntryPointClassification =
  | { readonly kind: "true_entry_point" }
  | {
      readonly kind: "framework_invoked";
      readonly group_id: string;
      readonly framework: string;
    }
  | { readonly kind: "dunder_protocol"; readonly protocol: string }
  | { readonly kind: "test_only" }
  | {
      readonly kind: "indirect_only";
      readonly via: IndirectReachabilityReason;
    };

export interface ClassifiedEntryPoint {
  readonly symbol_id: SymbolId;
  readonly classification: EntryPointClassification;
}

export interface ClassifiedEntryPoints {
  readonly true_entry_points: readonly ClassifiedEntryPoint[];
  readonly known_false_positives: readonly ClassifiedEntryPoint[];
}

export interface ClassifyOptions extends TraceCallGraphOptions {
  readonly registry?: KnownIssuesRegistry;
}
```

`Project.get_call_graph()` keeps `entry_points: readonly SymbolId[]` but filters internally via `enrich_call_graph` (using the bundled permanent registry by default). `Project.get_classified_entry_points(options?: ClassifyOptions)` returns the rich shape; the `registry` field on `ClassifyOptions` overrides the bundled registry (used by self-healing pipeline in `.8`).

## Files

- ADD: `packages/core/src/classify_entry_points/registry.permanent.json` (generated)
- ADD: `packages/core/src/classify_entry_points/registry_loader.ts` (mirrors `query_loader.ts`)
- ADD: `packages/core/src/classify_entry_points/enrich_call_graph.ts` (`.5` introduced; finalize default-registry wiring here)
- DELETE: `packages/core/src/trace_call_graph/filter_entry_points.python.ts`
- DELETE: `packages/core/src/trace_call_graph/filter_entry_points.ts` (the dispatcher; only Python is wired today)
- MODIFY: `packages/core/src/trace_call_graph/trace_call_graph.ts:154` — invoke `enrich_call_graph` internally to drive filtering; output filtered `SymbolId[]`
- MODIFY: `packages/core/src/project/project.ts:493` — keep `get_call_graph` shape; add `get_classified_entry_points(options?: ClassifyOptions): ClassifiedEntryPoints`
- MODIFY: `packages/core/src/index.ts` — export `classify_entry_points/` surface
- MODIFY: `packages/types/src/call_chains.ts:73-78` — `CallGraph` cleaner; new types
- MODIFY: `packages/core/package.json` — add `registry.permanent.json` to bundled `files`
- MODIFY: `packages/core/src/trace_call_graph/trace_call_graph.test.ts` — Python dunder describe (5 tests, lines 406-407, 470, 533, 649-652) flips from "is excluded" → "is classified `dunder_protocol`"

## In-flight TASK-190.16.\* annotations (must land with this task)

Because this task ships the path/type changes that affect ~12 in-flight TASK-190.16.\* tasks, annotate those tasks **at the same time** so executing agents during the migration window don't follow obsolete paths.

Tasks needing annotation: `190.16`, `190.16.4`, `.5`, `.7`, `.8`, `.9`, `.11`, `.12`, `.13`, `.17`, `.18`, `.19`, `.20`, `190.12`. Add a comment block to each:

> **Note (TASK-190.17.6 in flight):** Paths and types referenced here have moved. `EnrichedFunctionEntry` is now `EnrichedEntryPoint` in `@ariadnejs/types`; `auto_classify/orchestrator.ts` is now `packages/core/src/classify_entry_points/classify_entry_points.ts`. See TASK-190.17 for the full migration scope.

## Constraint — bundling the JSON

`registry.permanent.json` must be present in the published `dist/` directory. Add a `package.json#files` entry plus a smoke test that loads via `dist/`.

## Verification

- `pnpm test` in `packages/core` passes including updated dunder tests.
- A smoke test loads `registry.permanent.json` via the published `dist/` build.
- `Project.get_call_graph()` on a Python fixture with dunder methods returns no `__str__`/`__repr__` in `entry_points`.
- `Project.get_classified_entry_points()` returns the dunder methods in `known_false_positives` with `kind: "dunder_protocol"`.
- `tsc --noEmit` is clean across all packages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 registry.permanent.json generated and bundled in packages/core/dist/
- [ ] #2 filter_entry_points.python.ts deleted
- [ ] #3 filter_entry_points.ts dispatcher deleted
- [ ] #4 Python dunder methods (**str**, **repr**) covered by py-dunder-protocol registry entry with classification.kind == 'dunder_protocol'
- [ ] #5 Project.get_call_graph().entry_points returns SymbolIds of true positives only
- [ ] #6 Project.get_classified_entry_points() returns { true_entry_points, known_false_positives }
- [ ] #7 EntryPointClassification type with kinds true_entry_point | framework_invoked | dunder_protocol | test_only | indirect_only exported from @ariadnejs/types
- [ ] #8 ClassifyOptions accepts a registry override for self-healing pipeline use
- [ ] #9 trace_call_graph.test.ts dunder tests updated from 'is excluded' to 'is classified dunder_protocol'
- [ ] #10 Smoke test confirms registry.permanent.json loads from packages/core/dist/
- [ ] #11 packages/core package.json#files includes registry.permanent.json so it ships in the published bundle
- [ ] #12 tsc --noEmit clean across packages/core, packages/types, packages/mcp
- [ ] #13 pnpm test passes in packages/core, packages/types, packages/mcp
- [ ] #14 No circular dependency introduced between @ariadnejs/types and @ariadnejs/core
- [ ] #15 packages/core/src/project/project.test.ts, project.python.integration.test.ts, project.typescript.integration.test.ts, project.javascript.integration.test.ts, project.rust.integration.test.ts, project.integration.test.ts, load_project.test.ts: CallGraph literal fixtures updated to new entry_points semantics
- [ ] #16 packages/core/src/resolve_references/resolve_references.{python,typescript,javascript,rust}.test.ts: CallGraph references updated for filtered entry_points shape
- [ ] #17 New tests in packages/core/src/classify_entry_points/ (or project.test.ts) cover Project.get_classified_entry_points() returning the { true_entry_points, known_false_positives } shape, including a Python dunder fixture asserting kind: 'dunder_protocol'
- [ ] #18 New test asserts ClassifyOptions registry override works (skill-style full registry yields different known_false_positives than the bundled permanent slice)
- [ ] #19 In-flight TASK-190.16.\* tasks (~12) annotated with the path/type-move notice when this task ships
<!-- AC:END -->
