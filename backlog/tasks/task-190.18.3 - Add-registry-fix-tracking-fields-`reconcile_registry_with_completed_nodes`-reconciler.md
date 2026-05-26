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
dependencies:
  - TASK-190.18.6
parent_task_id: TASK-190.18
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The registry is the loop-closure surface. Schema fields and the reconciler that writes them ship together — the schema-only change is untestable in isolation since its only consumer is the reconciler.

## Scope — schema additions

- File: `.claude/skills/triage-entrypoints/src/known_issues_types.ts`
- Add two optional fields to `KnownIssue`:
  - `fixed_commit?: string` — git SHA where the upstream fix landed (copied from a `done` event's `merge_commit`)
  - `fixed_in_run?: string` — pipeline run-id whose `prepare_triage` step first stamped this entry as fixed
- Back-compat reads (treat absent as `undefined`/null)
- Add a small helper to the registry module: `find_groups_by_backlog_task(task_id: string): KnownIssue[]`
- Document the registry schema additions in triage-entrypoints `SKILL.md` registry section

## Scope — reconciler

- New file (the only file this task lands under fix-sequencer): `.claude/skills/fix-sequencer/scripts/reconcile_registry_with_completed_nodes.ts`. The skill scaffold — `SKILL.md`, `package.json`, `tsconfig.json`, `src/`, `templates/`, `paths.ts`, and the rest of `scripts/` — is owned by TASK-190.18.6 and lands first (see `dependencies`).
- The reconciler lives under the **fix-sequencer skill**, not triage-entrypoints. The classifier-lifecycle contract (`.claude/rules/classifier-lifecycle.md`) forbids any code under `triage-entrypoints/` from writing `registry.json`; the three-store model also forbids triage-entrypoints from knowing `~/.ariadne/fix-sequencer/` paths.
- Writes the registry via `atomic_update_registry(path, mutator)` from `@ariadnejs/skill-fs` — the same locked read-mutate-write helper the curator uses. Add `.claude/skills/fix-sequencer/scripts/reconcile_registry_with_completed_nodes.ts` to `ALLOWED_REGISTRY_WRITERS` in `packages/skill-fs/src/registry_writers.test.ts` (already pre-registered; verify it remains present).
- Reads `~/.ariadne/fix-sequencer/graph.json`
- Folds `~/.ariadne/fix-sequencer/state.jsonl` to find nodes whose latest event is `done`
- For each such node:
  - Gather its `member_task_ids`
  - For each task_id, call `find_groups_by_backlog_task(task_id)` to resolve matching registry entries
  - For each resolved entry whose `status !== 'fixed'`: flip `status: wip → fixed`, stamp `fixed_commit` (from the `done` event's `merge_commit`) and `fixed_in_run` (current pipeline run-id)
  - For each resolved entry already `fixed`: skip silently (idempotent, no double-stamping)
- The reconciler must short-circuit before calling `atomic_update_registry` when the fold produces zero flips, so identical inputs leave `registry.json` mtime-stable (AC #5).
- Invoked as a pre-step by `.claude/skills/triage-entrypoints/scripts/prepare_triage.ts` via **CLI shell-out** (`childProcess.execFileSync("node", ["--import", "tsx", RECONCILER_PATH, "--project", project, "--run-id", run_id])`), not a TypeScript import. Precedent: `prepare_triage.ts` already uses `execFileSync` for `git rev-parse`, and `detect_entrypoints.ts` uses `execSync` extensively. Triage-entrypoints must never `import` from fix-sequencer; exit code and stderr are surfaced as the reconciler's failure signal.
- Reuses `expand_task_scope` from `scripts/check-commit-message.ts:38` rather than re-implementing range expansion; the commit-msg hook already owns that semantics. (Long-term, consider promoting `expand_task_scope` into a workspace package so both the hook and the reconciler import from one place. Out of scope here; the relative import `../../../../scripts/check-commit-message.js` is acceptable as a placeholder.)
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

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `fixed_commit` and `fixed_in_run` fields added to known_issues_types.ts and the runtime registry shape
- [ ] #2 Back-compat read tests pass (entries written before this change still parse)
- [ ] #3 Schema additions (`fixed_commit`, `fixed_in_run`) documented in triage-entrypoints `SKILL.md` registry section; reconciler behavior (write path, OOB detection, idempotency, cross-project scope) documented in fix-sequencer `SKILL.md` (created by TASK-190.18.6)
- [ ] #4 `find_groups_by_backlog_task(task_id)` helper exported from the registry module; tested with single-match, no-match, and multi-match cases
- [ ] #5 Re-running reconciler on identical inputs leaves `registry.json` mtime-stable (zero-flip short-circuit before `atomic_update_registry`) AND emits zero log lines tagged `flipped`
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
- [ ] #17 The reconciler module lives under the fix-sequencer skill (`.claude/skills/fix-sequencer/scripts/reconcile_registry_with_completed_nodes.ts`); triage-entrypoints invokes it without importing any of its modules (CLI shell-out only)
- [ ] #18 The reconciler imports `expand_task_scope` from `scripts/check-commit-message.ts:38` rather than re-implementing range expansion
- [ ] #19 Registry writes go through `atomic_update_registry` from `@ariadnejs/skill-fs`; the reconciler appears in `ALLOWED_REGISTRY_WRITERS` AND `ALLOWED_SERIALIZER_CALLERS` in `packages/skill-fs/src/registry_writers.test.ts` (verify the pre-registered entry survives the merge)
<!-- AC:END -->
