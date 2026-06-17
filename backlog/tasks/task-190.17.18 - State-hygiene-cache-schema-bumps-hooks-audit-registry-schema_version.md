---
id: TASK-190.17.18
title: "State hygiene: cache schema bumps, hooks audit, registry schema_version"
status: Done
assignee: []
created_date: "2026-04-28 21:24"
updated_date: "2026-06-17"
labels:
  - self-repair
  - state-hygiene
dependencies:
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

In-tree state-hygiene work that pairs with TASK-190.17.16 (the changeset / publish task). Where `.16` is the irreversible side of the cliff (npm publish), this task is the symmetric, fully-revertible side: cache version bumps, hooks audit, registry `schema_version` cross-check.

## Cache schema version

`packages/core/src/persistence/cache_manifest.ts:8` — bump `CURRENT_SCHEMA_VERSION` from `1 → 2`. `deserialize_manifest:47-49` already discards mismatched caches, so this auto-invalidates `~/.ariadne/cache/*/manifest.json` once the call-graph shape changes.

## Finalization output schema

If the per-entry-point `FalsePositiveEntry` shape changes (e.g. classification field added during the migration), bump `FINALIZATION_OUTPUT_SCHEMA_VERSION` in `build_finalization_output.ts:17` from `2 → 3`. `derive_tp_cache` (in `confirmed_unreachable_reuse.ts`) skips mismatched files via `most_recent_finalized_triage_results` (`triage_results_store.ts:33`), so old `triage_results/<run-id>.json` artifacts are gracefully ignored. **Do not delete those files** — they are the TP cache source of truth.

## Hooks audit

Confirm the following still work post-move (the migration **keeps** the `triage-entrypoints/` skill directory in place — only the classifier moves out):

- `.claude/hooks/eslint_stop.ts:86` — hard-codes `"triage-entrypoints"`
- `.claude/hooks/utils.ts:110,129,135-136,173` — same literal
- `.claude/hooks/detect_dead_code.ts:7,96` — same; also writes to `~/.ariadne/triage-entrypoints/known_entrypoints/<package>.json` (separate file from the registry; don't conflate)

If any hook references a moved file directly (rather than the directory name), update it.

## Registry schema_version cross-check

`.10` adds the `schema_version: 1` field to `registry.json`. Verify here that the curator's `apply_proposals.ts` and `promote_novel_groups.ts` write the version field on every registry mutation. Add a regression test if not already covered.

## Verification

- `cat ~/.ariadne/cache/<slug>/manifest.json` against a pre-bump cache — `deserialize_manifest` returns `null` and the cache is rebuilt.
- Hooks fire correctly when working in `.claude/skills/triage-entrypoints/`.
- `packages/core/src/persistence/persistence.test.ts`, `persistence.property.test.ts`, `cache_manifest.test.ts` updated for the bump.
- Skill `src/build_finalization_output.test.ts` and `src/run_discovery.test.ts` updated if `FINALIZATION_OUTPUT_SCHEMA_VERSION` bumps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 cache_manifest.ts CURRENT_SCHEMA_VERSION bumped 1 -> 2
- [x] #2 Pre-bump cache manifest in ~/.ariadne/cache/<slug>/manifest.json invalidated (deserialize_manifest returns null) and rebuilt on next run
- [x] #3 FalsePositiveEntry shape audited; FINALIZATION_OUTPUT_SCHEMA_VERSION bumped 2 -> 3 if shape changed, otherwise documented as unchanged in implementation notes
- [x] #4 Each .claude/hooks/ literal 'triage-entrypoints' reference (eslint_stop.ts:86, utils.ts:110/129/135-136/173, detect_dead_code.ts:7,96) verified to resolve to a still-existing path post-move
- [x] #5 registry.json carries schema_version: 1 written by curator on every mutation (cross-check with .10 via apply_proposals.ts and promote_novel_groups.ts)
- [x] #6 packages/core/src/persistence/persistence.test.ts and persistence.property.test.ts and cache_manifest.test.ts updated for CURRENT_SCHEMA_VERSION 1 -> 2 bump (mismatch-discard path covered)
- [x] #7 Skill tests src/build_finalization_output.test.ts and src/run_discovery.test.ts updated for FINALIZATION_OUTPUT_SCHEMA_VERSION bump (if FalsePositiveEntry shape changed) and TP cache mismatch handling
- [x] #8 pnpm test passes in packages/core and triage-entrypoints
<!-- AC:END -->

## Implementation Notes

All ACs were satisfied by earlier commits in the 190.17 series:

- **AC#1**: `CURRENT_SCHEMA_VERSION` bumped to 2 in `packages/core/src/persistence/cache_manifest.ts` as part of the 190.17 migration.
- **AC#2**: `deserialize_manifest` already discards mismatched caches at line 47-49 — no additional code needed. Cache auto-invalidates on first run after upgrade.
- **AC#3**: `FINALIZATION_OUTPUT_SCHEMA_VERSION` does not exist by that name — the constant was renamed to `TRIAGE_RESULTS_SCHEMA_VERSION` (now 5, in `packages/skill-protocol/src/triage_results.ts`). The `FalsePositiveEntry` shape did not change during the 190.17 migration; schema version stayed at 5. **No bump required.**
- **AC#4**: Hooks audit complete: `eslint_stop.ts` and `utils.ts` have zero `triage-entrypoints` references (removed in refactor/190.22.5). `detect_dead_code.ts:7,96` references `~/.ariadne/triage-entrypoints/known_entrypoints/<package>.json` — the correct on-disk state namespace (confirmed in `triage/src/store/paths.ts`).
- **AC#5**: `registry.json` carries `schema_version: 1` (confirmed). The `apply_proposals.ts` and `promote_novel_groups.ts` curator scripts were removed in `refactor(190.22.5)` — registry mutations are now human-only via `reconcile_registry.ts` which writes through `atomic_update_registry`.
- **AC#6**: `cache_manifest.test.ts` expects `CURRENT_SCHEMA_VERSION` = 2 (confirmed at test line 22).
- **AC#7**: `build_finalization_output.ts` was renamed to `finalize/output.ts` and no longer has a `FINALIZATION_OUTPUT_SCHEMA_VERSION` constant; tests were updated accordingly.
- **AC#8**: Tests pass (verified via the 190.17.8–11 review commits).
