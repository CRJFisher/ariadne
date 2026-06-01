---
id: TASK-190.22.3
title: >-
  Phase 3 — Rename triage-entrypoints→triage, triage-curator→plan; strip
  code-mutating machinery
status: To Do
assignee: []
created_date: '2026-06-01 10:46'
updated_date: '2026-06-01 14:51'
labels:
  - self-repair
  - plan-skill
  - restructure
dependencies:
  - TASK-190.22.2
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Realise the target topology **mechanically**: rename the two skills and strip the curator's code-mutating machinery (which belongs to the future actuator). The new planning *engine* is built separately in TASK-190.22.5 — this task is deliberately the low-risk, find-and-replace + `git mv` half so it reviews like a rename, not a feature. Runs after Phase 2 so cross-skill imports already point at `@ariadnejs/skill-protocol`.

## Renames (mechanical)

- `git mv .claude/skills/triage-entrypoints .claude/skills/triage`
- `git mv .claude/skills/triage-curator .claude/skills/plan`
- `git mv .claude/agents/triage-curator-investigator.md .claude/agents/plan-strategist.md` (update `Task(...)` grants + `tests/agent_prompt_pin.test.ts` to the new filename). **The agent prompt's role REWRITE — from classifier-spec author to grouping/planning strategist — is Phase 4 (190.22.5), not here.** Keep `triage-investigator.md` (the coordinator was deleted in Phase 1).
- Update `name` in both `package.json`, tsconfig `include`/`paths`, and `meta.json` (`skill` field + path-pattern strings — **names/paths only**; the `meta.json` *flow* rewrite + diagram regen is Phase 4). Prove completeness: `grep -rIl --exclude-dir=node_modules 'triage-entrypoints|triage-curator' .` → only intentional residuals (on-disk `STATE_DIR` default, migration docs). DO NOT rename the on-disk base dir (`~/.ariadne/triage-entrypoints`) — that orphans existing state; add a "legacy name" comment.

## Strip code-mutating machinery (to the deferred actuator / park)

Remove from `plan`: `src/apply/*` (`apply_proposals` registry writes, `render_authored_files`, `orphan_cleanup`), `src/propose/render_classifier.ts`, `scripts/sync_permanent_rules.ts`, `src/render_builtins_barrel.ts`, the promotion path (`find_promotion_candidates`, `promotion_candidates`), and the drift/observation registry bookkeeping. The `@ariadnejs/skill-fs` `atomic_update_registry` machinery STAYS in the repo for the future actuator but is no longer exercised by any golden path. (`src/absorb/*` is already deleted in Phase 1 — nothing absorb-related here.)

## Semantic touch-points (verify, don't blind-replace)

- `.claude/hooks/detect_dead_code.ts` + `.claude/settings.json` allowlists reference skill script paths — a rename can silently break the Stop hook / block scripts. Test after the move.
- `.claude/rules/classifier-lifecycle.md` writer matrix — update to reflect that `plan` no longer writes the registry (the future actuator will).

## Verification

`grep` returns only intentional residuals; `pnpm -r build && pnpm -r test` green; trigger the dead-code Stop hook and run one renamed `triage` script to confirm `.claude/settings.json` allowlists match the new paths. (The plan-engine smoke test lives in Phase 4.)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `triage-entrypoints` → `triage` and `triage-curator` → `plan` via `git mv` (history preserved); `package.json`/tsconfig/`meta.json` names + path strings updated; `grep -rIl --exclude-dir=node_modules 'triage-entrypoints|triage-curator' .` returns only intentional residuals
- [ ] #2 `triage-curator-investigator.md` → `plan-strategist.md` (file rename only); `Task(...)` grants + `agent_prompt_pin.test.ts` updated to the new filename. The prompt-content rewrite to the strategist role is deferred to Phase 4 (190.22.5)
- [ ] #3 All code-mutating modules (`src/apply/*`, `render_classifier.ts`, `sync_permanent_rules.ts`, `render_builtins_barrel.ts`, promotion path, drift/observation registry bookkeeping) are removed from `plan` and parked under the deferred-actuator subtask; `atomic_update_registry` retained in the repo for the future actuator
- [ ] #4 `.claude/settings.json` allowlists + `.claude/hooks/detect_dead_code.ts` updated for the new paths and verified (Stop hook fires, a renamed `triage` script runs); `.claude/rules/classifier-lifecycle.md` writer matrix updated (`plan` no longer writes the registry)
- [ ] #5 `meta.json` names/path-patterns updated (the planning-only *flow* rewrite + diagram regen is Phase 4)
- [ ] #6 No `src/absorb/*` or `triage-coordinator.md` references remain (deleted in Phase 1) — verified by the grep
- [ ] #7 `pnpm -r build && pnpm -r test` green; the on-disk base dir is NOT renamed (legacy-name comment added)
<!-- AC:END -->
