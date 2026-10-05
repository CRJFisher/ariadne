---
id: TASK-190.20.5
title: >-
  Make finalize atomic + idempotent; persist MCP-created task ids before
  registry linkage
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - correctness
  - atomicity
dependencies: []
parent_task_id: TASK-190.20
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Three closely-related correctness gaps surface in the finalize path:

1. **Non-atomic sentinel write.** `src/curation_outcome.ts:31` writes
   `finalized.json` with raw `fs.writeFile`. A crash mid-write leaves a
   truncated/empty sentinel; subsequent `is_curated` returns true (file
   exists) but Step-6 replay (parsing
   `outcome.signal_library_gap_tasks` /
   `outcome.ariadne_bug_tasks` from the sentinel) blows up.

2. **Replay double-bumps `observed_count`.** `scripts/finalize_run.ts`
   runs `apply_proposals` (registry write at ~L311) → orphan unlinks →
   derived-file regen → `save_outcome` (sentinel write at ~L404). The
   sentinel is the _guard against re-run_. If finalize crashes after the
   registry write but before the sentinel, the next run re-enters
   `apply_proposals` and `bump_observed_stats` adds the same run's counts
   a second time. The comment at `apply_proposals.ts:104-106` already
   acknowledges this is unsafe outside the sentinel guard.

3. **No persistence of MCP-created task ids between `task_create` and
   `link_ariadne_bug_tasks`.** The orchestrator pattern documented in
   SKILL.md Step 6b builds a `{target_registry_group_id: TASK-N}` map in
   memory between MCP calls and the linkage script. A crash between
   creating tasks and writing the mapping strands the task without a
   registry backlink, and a re-run duplicate-creates (no idempotency key
   on `mcp__backlog__task_create`).

These three together describe a single failure mode (curator dies
mid-finalize) and are cheapest to fix in one pass.

## Scope

### 1. Atomic sentinel write

- Route `save_outcome` in `src/curation_outcome.ts` through
  `atomic_write_file` (temp + rename)
- Add a test that asserts a partial write (simulate via fault injection)
  leaves the previous-sentinel state intact

### 2. Idempotent replay

Choose ONE of:

**Option A — Sentinel-first marker.** Write a
`{status: "in_progress", run_id, started_at}` sentinel via
`atomic_write_file` _before_ `apply_proposals` runs. On successful
completion overwrite with the full `CuratedRunEntry`. `is_curated` is
unchanged (any sentinel means "already finalized") — the new sentinel
just appears earlier. Replay reads the in-progress sentinel and refuses
to re-apply.

**Option B — Run-id-keyed bookkeeping.** Make
`bump_observed_stats` consult a per-row set of `seen_in_runs:
Set<run_id>` before incrementing. Replay against the same run_id is a
no-op. Touches the `KnownIssue` shape (`@ariadnejs/types`).

Pick A unless registry-shape additions are independently desired. Document
the choice in Implementation Notes.

### 3. MCP task-id sidecar

- Persist a sidecar `created_backlog_tasks.json` incrementally as each
  MCP call returns, before `link_ariadne_bug_tasks.ts` is invoked
- `link_ariadne_bug_tasks.ts` reads the sidecar if it exists and skips
  already-linked entries
- Document the file in SKILL.md's Step 6 alongside `--mapping`

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 `save_outcome` uses `atomic_write_file`; a regression test
      exercises the failure-during-write path
- [ ] #2 A finalize crash between `apply_proposals` and the final
      sentinel write does not double-bump `observed_count` on replay
      (verified via test fixture)
- [ ] #3 A crash between `mcp__backlog__task_create` and
      `link_ariadne_bug_tasks` does not duplicate-create on rerun; the
      sidecar file is the recovery surface
- [ ] #4 SKILL.md Step 6 names the sidecar file and the crash-recovery
      procedure
- [ ] #5 `pnpm test` is green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

These three fixes share the same failure mode but touch different files.
Suggest landing #1 + #2 as one PR (both inside `finalize_run.ts` +
`curation_outcome.ts`) and #3 as a separate PR (touches
`link_ariadne_bug_tasks.ts` + SKILL.md). Mark them as one task here
because review effort is amortised when read together.
