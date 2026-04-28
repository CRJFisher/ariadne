---
id: TASK-190.17.5
title: Move orchestrator into core; introduce `enrich_call_graph()` primitive
status: To Do
assignee: []
created_date: "2026-04-28 19:14"
updated_date: "2026-04-28 19:32"
labels:
  - self-repair
  - core-refactor
dependencies:
  - TASK-190.17.4
parent_task_id: TASK-190.17
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Move the rule-application orchestrator and predicate evaluator from the skill into core. Introduce `enrich_call_graph()` as the new top-level primitive that both the basic API and the skill consume.

## Moves

| Source (skill)                                                                             | Destination                                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `.claude/skills/self-repair-pipeline/src/auto_classify/orchestrator.ts`                    | `packages/core/src/classify_entry_points/classify_entry_points.ts` |
| `.claude/skills/self-repair-pipeline/src/auto_classify/predicate_evaluator.ts` (impl)      | `packages/core/src/classify_entry_points/predicate_evaluator.ts`   |
| `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/index.ts` (generated)      | `packages/core/src/classify_entry_points/builtins/index.ts`        |
| `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/check_*.ts` (~60-90 files) | `packages/core/src/classify_entry_points/builtins/check_*.ts`      |
| `.claude/skills/self-repair-pipeline/src/known_issues_registry.ts` (loader)                | split — see `.10`                                                  |

All `check_*.ts` need their internal imports updated to use `@ariadnejs/types` for `EnrichedEntryPoint`. The renderer (`render_classifier.ts` in triage-curator) is updated separately in `.12` to emit the new path; for this sub-sub-task, codemod the existing files in place.

## New primitive: `enrich_call_graph`

```ts
// packages/core/src/classify_entry_points/enrich_call_graph.ts
export interface EnrichedCallGraph {
  readonly call_graph: CallGraph;
  readonly classified_entry_points: ClassifiedEntryPoints;
  readonly diagnostics_by_id: ReadonlyMap<SymbolId, EntryPointDiagnostics>;
}

export function enrich_call_graph(
  call_graph: CallGraph,
  project: Project,
  options?: { registry?: KnownIssuesRegistry }
): EnrichedCallGraph;
```

`ClassifiedEntryPoints` is the `{ true_entry_points, known_false_positives }` container introduced in `.6`; both fields are `readonly ClassifiedEntryPoint[]`.

Default registry is loaded from `registry.permanent.json` (created in `.6`); for now wire it to accept the registry as a required parameter and have callers pass it explicitly. `.6` flips the default.

## Caching

Cache `EnrichedCallGraph` on the `Project` instance keyed by `(call_graph_hash, registry_hash)`. Run the work once even when both `get_call_graph()` (post-`.6`) and `get_classified_entry_points()` (post-`.6`) are called in the same session.

## Skill side

Skill keeps thin re-exports of the old `auto_classify/orchestrator.ts` path. Phase 8 (`.8`) retargets `prepare_triage.ts` to call `enrich_call_graph` directly.

## Verification

- `pnpm test` in `packages/core/` passes; new orchestrator tests cover predicate, builtin, and `kind: none` skip paths.
- Skill's `prepare_triage` still works via the re-export.
- No new circular deps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 auto_classify/orchestrator.ts moved to packages/core/src/classify_entry_points/classify_entry_points.ts
- [ ] #2 predicate_evaluator.ts impl moved to packages/core/src/classify_entry_points/predicate_evaluator.ts
- [ ] #3 All builtins/check\_\*.ts files moved with @ariadnejs/types import updates
- [ ] #4 Generated builtins/index.ts barrel updated to new location
- [ ] #5 enrich_call_graph(call_graph, project, options?) primitive exported from core
- [ ] #6 EnrichedCallGraph cached on Project keyed by (call_graph_hash, registry_hash)
- [ ] #7 Cache hit path reuses prior EnrichedCallGraph when same key recomputed in the same Project session
- [ ] #8 Skill re-export of old orchestrator path preserves prepare_triage.ts compatibility
- [ ] #9 Orchestrator tests cover predicate, builtin, and kind: none skip paths
- [ ] #10 No new circular dependency introduced between packages or skills
- [ ] #11 pnpm test passes in packages/core and self-repair-pipeline
- [ ] #12 Persistence cache integration: enrich_call_graph results keyed as classify:{registry_hash}:{project_content_hash}:{symbol_id} against cache_manifest.ts so warm runs are effectively free
- [ ] #13 New core test asserts EnrichedCallGraph cache hit: enrich_call_graph called twice with same (call_graph_hash, registry_hash) returns cached instance (single classifier run)
- [ ] #14 New core test asserts cache invalidates on registry change (different registry_hash → fresh enrichment)
<!-- AC:END -->
