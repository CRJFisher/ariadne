---
id: TASK-190.18.3
title: >-
  Add registry fix-tracking fields + `reconcile_registry_with_completed_nodes`
  reconciler
status: To Do
assignee: []
created_date: "2026-04-29 10:30"
updated_date: "2026-04-29 14:24"
labels:
  - self-repair
  - fix-sequencer
  - self-repair-pipeline-extension
  - loop-closure
dependencies: []
parent_task_id: TASK-190.18
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The registry is the loop-closure surface. Schema fields and the reconciler that writes them ship together — the schema-only change is untestable in isolation since its only consumer is the reconciler.

## Scope — schema additions

- File: `.claude/skills/self-repair-pipeline/src/known_issues_types.ts`
- Add two optional fields to `KnownIssue`:
  - `fixed_commit?: string` — git SHA where the upstream fix landed (copied from a `done` event's `merge_commit`)
  - `fixed_in_run?: string` — pipeline run-id whose `prepare_triage` step first stamped this entry as fixed
- Back-compat reads (treat absent as `undefined`/null)
- Add a small helper to the registry module: `find_groups_by_backlog_task(task_id: string): KnownIssue[]`
- Document the registry schema additions in self-repair-pipeline `SKILL.md` registry section

## Scope — reconciler

- New file: `.claude/skills/self-repair-pipeline/scripts/reconcile_registry_with_completed_nodes.ts`
- Reads `~/.ariadne/fix-sequencer/graph.json`
- Folds `~/.ariadne/fix-sequencer/state.jsonl` to find nodes whose latest event is `done`
- For each such node:
  - Gather its `member_task_ids`
  - For each task_id, call `find_groups_by_backlog_task(task_id)` to resolve matching registry entries
  - For each resolved entry whose `status !== 'fixed'`: flip `status: wip → fixed`, stamp `fixed_commit` (from the `done` event's `merge_commit`) and `fixed_in_run` (current pipeline run-id)
  - For each resolved entry already `fixed`: skip silently (idempotent, no double-stamping)
- Wire as a pre-step in `.claude/skills/self-repair-pipeline/scripts/prepare_triage.ts` so it runs BEFORE classifiers are bucketed
- Idempotent
- Missing `graph.json` / `state.jsonl` is non-fatal (logs and continues — handles fresh installs)
- Backlog consulted only as a fallback signal if a `done` event lacks `merge_commit`
- Tolerates a partially-written final line of `state.jsonl` (worker mid-append): last partial line is skipped

## Scope — out-of-band fix detection

In addition to consuming `done` events from `state.jsonl`, the reconciler scans the target project's git log between the prior run's `commit_hash` and HEAD for Conventional-Commits scoped with task ids (`fix(190.16.42): …`, `feat(190.17.12-14): …`). For each captured task id (range scopes expand), it synthesizes an in-memory `done` event and routes it through the same write path as state.jsonl-sourced events.

Rationale: real Ariadne devs land fixes outside the fix-sequencer worker workflow. Without this, `wip` rules whose underlying issues are already fixed in core accumulate stale state indefinitely. The commit convention enforced by `.claude/rules/commit-convention.md` (and the `commit-msg` hook) guarantees the format, so the regex stays trivial:

- Subject parse: `/^[a-z]+\(([\d.\-]+)\):/`
- Range expansion: `190.17.12-14` → `[190.17.12, 190.17.13, 190.17.14]`
- Body trailer (secondary): `/^(?:Fixes|Implements|Closes):\s*TASK-([\d.]+)/m`

Synthesized events are NOT appended to `state.jsonl` (which would duplicate on every run); only the registry flip persists. Idempotent because the reconciler's `status === "fixed"` skip path applies uniformly to both event sources.

## Cut from earlier draft

`superseded_by_fix` was originally proposed but is dropped per YAGNI — set-but-never-read in v1. If superseded-classifier skipping is needed later, derive it on the fly from `(status === 'fixed' AND fixed_commit ancestor of HEAD)`.

## Merge note

Originally split as TASK-190.18.3 (schema) + TASK-190.18.4 (reconciler). Merged after Reviewer 2 pointed out that the schema-only change has no testable behavior without its only consumer; .4 archived. Out-of-band detection (AC #12-16) folded in here rather than spawning a new sub-task — it reuses the reconciler's existing write path.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `fixed_commit` and `fixed_in_run` fields added to known_issues_types.ts and the runtime registry shape
- [ ] #2 Back-compat read tests pass (entries written before this change still parse)
- [ ] #3 Documented in self-repair-pipeline SKILL.md registry section
- [ ] #4 `find_groups_by_backlog_task(task_id)` helper exported from the registry module; tested with single-match, no-match, and multi-match cases
- [ ] #5 Re-running reconciler on identical inputs leaves `registry.json` byte-equal AND emits zero log lines tagged `flipped`
- [ ] #6 Wired into prepare_triage.ts so it runs before classifiers are bucketed
- [ ] #7 Logs which registry entries flipped status this run (one line per flip, tagged `flipped`)
- [ ] #8 Missing graph.json / state.jsonl is non-fatal (logs and continues)
- [ ] #9 Tolerates a partially-written final line of state.jsonl; last partial line skipped; documented
- [ ] #10 Backlog consulted only as fallback when `done` event lacks merge_commit
- [ ] #11 Unit tests cover idempotency, missing-files, stale-event, partial-final-line, and already-fixed-entry cases
- [ ] #12 Out-of-band fix detector: extracts task ids from Conventional-Commit subjects (`^[a-z]+\(([\d.\-]+)\):`) and body trailers (`^(?:Fixes|Implements|Closes):\s*TASK-([\d.]+)`) over `git log <last_run_commit>..HEAD`. Range scopes (`190.17.12-14`) expand to individual ids. Synthesized `done` events route through the same write path as state.jsonl events but are NOT appended to `state.jsonl` (in-memory only)
- [ ] #13 Fan-out: when `find_groups_by_backlog_task` returns multiple registry entries for one task id, ALL matching entries are flipped (not just the first). Test fixture: two `wip` rules share one `backlog_task`; one fix commit flips both
- [ ] #14 First-run / missing-prior-commit: when `RunManifest.commit_hash` is `null`, the git-log scan is skipped silently with a `git-log-scan: no prior commit` log line. Not fatal
- [ ] #15 Unreachable prior SHA (rebase/squash): when `git log <stale_sha>..HEAD` exits non-zero, fall back to a date-bounded range using `RunManifest.created_at` as the lower bound. Logged at info level. Not fatal
- [ ] #16 Cross-project scope discipline: the scan targets the project under analysis's repo, not the Ariadne repo. A `fix(190.16.42)` commit in the Ariadne repo will NOT trigger a flip while preparing a run on an external corpus. Documented in SKILL.md as expected behavior
<!-- AC:END -->
