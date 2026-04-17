---
id: TASK-190.16.8
title: Remove known-entrypoints cache (stateless pipeline)
status: To Do
assignee: []
created_date: "2026-04-17 14:38"
labels:
  - self-repair
  - cleanup
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
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

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase E.

The per-project known-entrypoints cache has a fundamental drift problem: when the target repo changes, cached labels survive even when the underlying facts no longer hold. The auto-classifier supersedes the cache — every run re-derives labels from current tree-sitter queries, current resolver state, and the current registry. The canonical state is the repo-tracked registry (drift-free), not the implicit per-project cache.

**Delete:**

- `.claude/skills/self-repair-pipeline/src/known_entrypoints.ts` + `.test.ts`
- `.claude/hooks/entrypoint_stop.ts` (and its registration in `.claude/settings.json` / `settings.local.json`)
- `KnownEntrypointSource` interface at `.claude/skills/self-repair-pipeline/src/types.ts:77`
- Cache storage paths in `src/paths.ts`
- Cache-directory artefacts under `~/.ariadne/self-repair-pipeline/<project>/known_entrypoints*`

**Modify:**

- `scripts/prepare_triage.ts` — remove `load_known_entrypoints()` + `filter_known_entrypoints()` calls (lines ~77–78); `auto_classify()` replaces them.
- `scripts/finalize_triage.ts` — confirm no cache-update step remains.
- `SKILL.md` + `README.md` — drop "cache" nomenclature; replace with "registry" references.

**Already deleted in commit `edd5e883` (no action needed):** `src/classify_entrypoints.ts` + `.test.ts`.

**Trade-off acknowledged in the plan:** true positives (real unused code) are re-sent to the LLM every run. Acceptable because the residual set is expected to be small once classifier coverage lands, and it removes an entire class of correctness bugs.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 All files listed in the 'Delete' section above are removed
- [ ] #2 No code path loads or writes `known_entrypoints*` JSON
- [ ] #3 Running the pipeline against webpack twice back-to-back produces identical triage output with no persisted state between runs
- [ ] #4 `entrypoint_stop` hook is unregistered from `.claude/settings.json` and `settings.local.json`
- [ ] #5 `SKILL.md` and `README.md` pipeline-stage descriptions match the new stateless flow
- [ ] #6 Test suite (55/55 before this work) still passes after the removal — cache-specific tests are either deleted or refactored to target the registry
- [ ] #7 `FilterResult.remaining` branch is removed from `prepare_triage.ts`; `paths.ts` cache-path helper functions are removed (paths module itself retained for non-cache uses)
- [ ] #8 On first run after this change lands, pre-existing `~/.ariadne/self-repair-pipeline/<project>/known_entrypoints*` artefacts do not cause errors — the pipeline either ignores them or deletes them
<!-- AC:END -->
