---
id: TASK-190.22.16.1
title: >-
  TP cache: fall back through older runs at same commit to avoid alternating
  re-investigation
status: Done
assignee: []
created_date: '2026-06-10 09:37'
updated_date: '2026-06-10 10:33'
labels:
  - self-repair
  - bug
dependencies: []
parent_task_id: TASK-190.22.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

After the fix in TASK-190.22.16, `build_cache` correctly excludes `previously-confirmed-tp` rows. But `derive_tp_cache` still only looks at the **single most recent** finalized run at the current commit. When that run published entries as `previously-confirmed-tp` (because it was itself a reuse run), the cache comes back empty and all entries are re-investigated — producing fresh `llm-tp` rows, which the _next_ run reuses, then publishes as `previously-confirmed-tp` again, and so on indefinitely.

## Failure scenario

Three runs at commit X:

- Run 1: LLM investigates entries → publishes `source: { kind: "llm-tp" }`
- Run 2: cache hits run 1 → reuses → publishes `source: { kind: "previously-confirmed-tp" }`
- Run 3: `build_cache` sees run 2 (most recent), filters out all `previously-confirmed-tp` rows → null cache → re-investigates everything via LLM → back to `llm-tp`
- Run 4: reuses run 3 → `previously-confirmed-tp` again
- ... alternates forever

## Root cause

`derive_tp_cache` in `.claude/skills/triage/src/finalize/confirmed_unreachable_reuse.ts` calls `most_recent_finalized_triage_results` and takes the result as-is. If that single run has no eligible (`llm-tp`) rows, it returns null rather than trying older runs at the same commit that do have them.

## Fix direction

Add a function to `.claude/skills/triage/src/store/triage_results_store.ts` — `all_finalized_runs_at_commit(project, short_commit)` — that returns all finalized runs whose run_id starts with `<short_commit>-`, sorted lexicographically descending (newest first).

In `derive_tp_cache`, replace the single lookup with an iteration:

```typescript
const runs = await all_finalized_runs_at_commit(project, current_short_commit);
for (const run of runs) {
  const cache = build_cache(run.run_id, run.output);
  if (cache !== null) return cache;
}
return null;
```

The loop stops at the first run that has at least one `llm-tp` row. In practice this is almost always 2 file reads maximum (the most recent reuse-run is skipped, then the original investigation run is found). No schema changes. No origin-tracking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 all_finalized_runs_at_commit is added to triage_results_store.ts, returning runs at the given short_commit sorted newest-first
- [x] #2 derive_tp_cache iterates through all runs at the commit (newest first) and uses the first one that yields a non-null cache
- [x] #3 a run whose confirmed_unreachable rows are all previously-confirmed-tp is skipped and the next older run's llm-tp rows are used
- [x] #4 the alternating cadence is broken: a genuine TP investigated at commit X is reused by every subsequent run at commit X without re-triggering LLM investigation
- [x] #5 tests for all_finalized_runs_at_commit live in triage_results_store.test.ts
- [x] #6 the derive_tp_cache fallback behaviour is covered in confirmed_unreachable_reuse.test.ts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

The TP cache previously took only the single most-recent finalized run at the current commit. When that run had published all its entries as `previously-confirmed-tp` (because it was itself a cache-hit run), `build_cache` returned null and every entry was re-routed to LLM investigation — producing fresh `llm-tp` rows that the next run reused, publishing `previously-confirmed-tp` again, and so on indefinitely.

The fix has two parts. `all_finalized_runs_at_commit` in `triage_results_store.ts` replaces `most_recent_finalized_triage_results`: it returns all run-ids at the current commit sorted newest-first, without reading any files. `derive_tp_cache` in `confirmed_unreachable_reuse.ts` reads each run's output lazily and stops at the first run that yields a non-null cache. A reuse-run (all `previously-confirmed-tp`) returns null from `build_cache` and the loop advances to the next older run, which contains the original `llm-tp` rows. In practice this is at most two file reads.

The lazy design keeps file I/O proportional to runs actually needed (not total runs at the commit). `most_recent_finalized_triage_results` is removed — `derive_tp_cache` was its only production caller.

**What changed**: `triage_results_store.ts` exports `all_finalized_runs_at_commit(project, commit) → string[]` (run-ids only, sorted newest-first). `derive_tp_cache` iterates the list, reading each file on demand via `read_triage_results`, and returns the first non-null cache. SKILL.md L329 updated to reference the new function name.

**Navigate to**: `confirmed_unreachable_reuse.ts:derive_tp_cache` for the fallback loop; `triage_results_store.ts:all_finalized_runs_at_commit` for the directory scan. Tests in `confirmed_unreachable_reuse.test.ts` under "fallback through older runs" cover the alternating scenario directly.

**Watch**: A run where the newest file at the commit is corrupt/legacy-schema will still throw (parse error propagates from `read_triage_results`). This matches prior behavior for the single-run path and is an accepted known edge case.
<!-- SECTION:NOTES:END -->
