---
id: TASK-190.16.8
title: Remove triage-pipeline cache; rename Stop hook to detect_dead_code
status: To Do
assignee: []
created_date: "2026-04-17 14:38"
labels:
  - self-repair
  - cleanup
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - /Users/chuck/.claude/plans/read-backlog-task-190-19-4-tingly-planet.md
  - .claude/skills/self-repair-pipeline/src/known_entrypoints.ts
  - .claude/hooks/entrypoint_stop.ts
  - .claude/skills/self-repair-pipeline/src/types.ts
  - .claude/skills/self-repair-pipeline/src/paths.ts
  - .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts
  - .claude/skills/self-repair-pipeline/SKILL.md
parent_task_id: TASK-190.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan references: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase E; `~/.claude/plans/read-backlog-task-190-19-4-tingly-planet.md` — corrected scope.

Two different concerns were previously stuffed into the same `known_entrypoints/<pkg>.json` files:

1. A **static per-package whitelist** of legitimate entry points (framework handlers, CLI mains, public APIs). Human-maintained, consulted by the Stop hook to catch dead code introduced during Claude coding sessions.
2. A **dynamic memoization** of triage-agent decisions written by the self-repair pipeline.

This task untangles them. The whitelist stays and remains human-owned. The Stop hook stays — its purpose (dead-code guardrail per coding session) is valuable and orthogonal to the self-repair pipeline. Only the pipeline's write/read path into the whitelist is removed, since the classifier registry (TASK-190.16.4) replaces its memoization need.

The hook is also renamed: `entrypoint_stop.ts` described the Claude Code event (`Stop`), not the purpose. Renaming to `detect_dead_code.ts` makes the intent self-evident.

**Delete (skill-side triage cache):**

- `.claude/skills/self-repair-pipeline/src/known_entrypoints.ts` + `.test.ts` — only used by triage
- `KnownEntrypoint`, `KnownEntrypointSource`, `KnownEntrypointMatch`, `FilterResult` types from `.claude/skills/self-repair-pipeline/src/types.ts` — only consumed by the deleted module
- The cache-path helper in `.claude/skills/self-repair-pipeline/src/paths.ts` (only the `known_entrypoints/` one; keep path helpers used by the triage pipeline itself)

**Rename (preserve history with `git mv`):**

- `.claude/hooks/entrypoint_stop.ts` → `.claude/hooks/detect_dead_code.ts`
- Update `.claude/settings.json` Stop-hook registration to point at the new path
- Tighten the module docstring to describe the dead-code guardrail role
- Update references in `SKILL.md`, `README.md`, the parent plan, TASK-190.16, TASK-190.16.4, TASK-204, TASK-205; leave completed task-177 historical record unchanged

**Retain (unchanged behaviour):**

- The whitelist files at `~/.ariadne/self-repair-pipeline/known_entrypoints/<pkg>.json`
- The renamed hook's `load_whitelist()` and dead-code-detection logic
- The Stop-hook registration itself (just the command path changes)

**Modify:**

- `scripts/prepare_triage.ts` — remove `load_known_entrypoints()` + `filter_known_entrypoints()` calls; `auto_classify()` (TASK-190.16.5) replaces them
- `scripts/finalize_triage.ts` — confirm no pipeline write path to the whitelist survives
- `SKILL.md` + `README.md` — remove any language suggesting the pipeline maintains the whitelist; add a "Dead-code guardrail" section describing the renamed hook's separate role

**Already deleted in commit `edd5e883` (no action needed):** `src/classify_entrypoints.ts` + `.test.ts`.

**Trade-off acknowledged:** true positives (real unused code) are re-sent to the LLM every triage run. Acceptable because the residual set is expected to be small once classifier coverage lands, and it removes an entire class of correctness bugs from the triage side.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `src/known_entrypoints.ts` + `.test.ts` are removed; `KnownEntrypoint`, `KnownEntrypointSource`, `KnownEntrypointMatch`, `FilterResult` types are removed from `src/types.ts`; the `known_entrypoints/` cache-path helper is removed from `src/paths.ts`
- [ ] #2 No code path in `.claude/skills/self-repair-pipeline/` loads or writes `known_entrypoints*.json`
- [ ] #3 Back-to-back pipeline runs against webpack produce identical triage output (no persisted per-project triage state between runs)
- [ ] #4 The Stop hook is renamed to `.claude/hooks/detect_dead_code.ts` via `git mv` (history preserved); `.claude/settings.json` is updated to register the new path; Stop-event behaviour on a dirty-git-worktree project is unchanged
- [ ] #5 `SKILL.md` and `README.md` describe the pipeline stages without referencing a pipeline-maintained cache; a new "Dead-code guardrail" section documents the renamed hook's role, the whitelist location, and how to add entries (edit JSON and commit)
- [ ] #6 Test suite passes; cache-specific tests in the skill are deleted; any hook-adjacent tests are retained
- [ ] #7 `FilterResult.remaining` branch is removed from `prepare_triage.ts`; `paths.ts` retains non-cache helpers; only the cache-path helper is removed
- [ ] #8 Pre-existing `~/.ariadne/self-repair-pipeline/<project>/known_entrypoints/*.json` files are left in place; the SKILL.md docs note recommends a one-time audit to review entries that were auto-added by the old pipeline write path
- [ ] #9 References to `entrypoint_stop` in parent plan, TASK-190.16, TASK-190.16.4, TASK-204, TASK-205 are updated to `detect_dead_code`; `backlog/completed/task-177` is left unchanged (historical record)
<!-- AC:END -->
