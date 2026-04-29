---
id: TASK-190.17.8
title: >-
  self-healing: rewrite `src/prepare_triage.ts` to call core via
  `enrich_call_graph`
status: Done
assignee: []
created_date: "2026-04-28 19:16"
updated_date: "2026-04-28 19:39"
labels:
  - self-repair
  - skill-retarget
dependencies:
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Replace the in-skill `auto_classify` invocation with a call to the new core API. The user has already split the script into `scripts/prepare_triage.ts` (CLI + run lifecycle) and `src/prepare_triage.ts` (library); the library still calls `auto_classify(input.entries, input.registry, input.read_file_lines)` from the in-skill orchestrator at line 58.

## Changes

- `.claude/skills/self-repair-pipeline/src/prepare_triage.ts:58` — replace the call:

  ```ts
  // before
  const classified = auto_classify(
    input.entries,
    input.registry,
    input.read_file_lines
  );

  // after
  const enriched = enrich_call_graph(input.call_graph, input.project, {
    registry: input.registry,
  });
  // map enriched.classified_entry_points into the existing skill-internal shape
  ```

- `.claude/skills/self-repair-pipeline/src/prepare_triage.ts:14` — drop the `auto_classify` import; add `enrich_call_graph` from `@ariadnejs/core`.
- The skill's `prepare_triage()` function must still return the `{ entries, stats }` shape consumed by `scripts/prepare_triage.ts`. Adapt the core output via a small mapping function.
- The script (`scripts/prepare_triage.ts`) is unchanged — it already does the run-lifecycle work (manifest, LATEST pointer, tp*cache integration at lines 203-249). The tp_cache is layered \_on top of* classification, so it still works correctly with classification-from-core.

## Constraint — `tp_cache` is unaffected

`scripts/prepare_triage.ts:203-249` (the tp_cache pass: `derive_tp_cache` call, `apply_tp_cache_to_entries`, and the `tp_cache` block in the run manifest) operates on already-classified entries. It short-circuits **triage**, not classification. It stays in the skill regardless of where the classifier runs.

## Constraint — full registry, not permanent slice

The pipeline calls `enrich_call_graph(call_graph, project, { registry: full_skill_registry })` so it sees both `permanent` and `wip` matches. The pipeline cross-references `group_id` against the registry to know the rule's status.

## Verification

- `pnpm test` in `.claude/skills/self-repair-pipeline/` passes.
- `pnpm exec tsx scripts/prepare_triage.ts --analysis <fixture> --project <name>` produces a run directory with the same shape as before.
- The classification output for permanent + wip rule matches lines up with what `auto_classify` produced pre-rewrite (sanity check via a one-off diff).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 src/prepare_triage.ts:58 calls enrich_call_graph from @ariadnejs/core instead of auto_classify
- [x] #2 src/prepare_triage.ts:14 import of in-skill auto_classify removed
- [x] #3 Skill's prepare_triage() function still returns the { entries, stats } shape
- [x] #4 Mapping from EnrichedCallGraph.classified_entry_points to skill-internal entries preserved
- [x] #5 scripts/prepare_triage.ts is not modified (tp_cache flow unaffected)
- [x] #6 Full skill registry is passed to enrich_call_graph (not the permanent slice)
- [x] #7 pnpm test passes in .claude/skills/self-repair-pipeline/
- [x] #8 Diff vs pre-rewrite shows zero classification changes on a representative fixture
- [x] #9 Out-of-scope (explicit non-changes): src/tp_cache.ts, src/run_discovery.ts, src/triage_state_paths.ts, src/triage_state_types.ts, RunManifest/TpCacheRecord types, and lifecycle scripts (list_runs, abandon_run, prune_runs, diff_runs, migrate_legacy_state) all remain in the skill; they are operator-state concerns wrapping the new core API and do not depend on classifier internals
<!-- AC:END -->
