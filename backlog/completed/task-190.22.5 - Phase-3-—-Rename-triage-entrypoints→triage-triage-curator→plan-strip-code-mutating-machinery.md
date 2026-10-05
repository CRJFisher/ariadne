---
id: TASK-190.22.5
title: >-
  Phase 3 — Rename triage-entrypoints→triage, triage-curator→plan; strip
  code-mutating machinery
status: Done
assignee: []
created_date: '2026-06-01 10:46'
updated_date: '2026-06-02 12:45'
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

Realise the target topology **mechanically**: rename the two skills and strip the curator's code-mutating machinery (which belongs to the future actuator). The new planning *engine* is built separately in TASK-190.22.9 — this task is deliberately the low-risk, find-and-replace + `git mv` half so it reviews like a rename, not a feature. Runs after Phase 2 so cross-skill imports already point at `@ariadnejs/skill-protocol`.

## Renames (mechanical)

- `git mv .claude/skills/triage-entrypoints .claude/skills/triage`
- `git mv .claude/skills/triage-curator .claude/skills/plan`
- `git mv .claude/agents/triage-curator-investigator.md .claude/agents/plan-strategist.md` (update `Task(...)` grants + `tests/agent_prompt_pin.test.ts` to the new filename). **The agent prompt's role REWRITE — from classifier-spec author to grouping/planning strategist — is Phase 4 (190.22.9), not here.** Keep `triage-investigator.md` (the coordinator was deleted in Phase 1).
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
- [x] #1 `triage-entrypoints` → `triage` and `triage-curator` → `plan` via `git mv` (history preserved); `package.json`/tsconfig/`meta.json` names + path strings updated; `grep -rIl --exclude-dir=node_modules 'triage-entrypoints|triage-curator' .` returns only intentional residuals
- [x] #2 `triage-curator-investigator.md` → `plan-strategist.md` (file rename only); `Task(...)` grants + `agent_prompt_pin.test.ts` updated to the new filename. The prompt-content rewrite to the strategist role is deferred to Phase 4 (190.22.9)
- [x] #3 All code-mutating modules (`src/apply/*`, `render_classifier.ts`, `sync_permanent_rules.ts`, `render_builtins_barrel.ts`, promotion path, drift/observation registry bookkeeping) are removed from `plan` and parked under the deferred-actuator subtask; `atomic_update_registry` retained in the repo for the future actuator
- [x] #4 `.claude/settings.json` allowlists + `.claude/hooks/detect_dead_code.ts` updated for the new paths and verified (Stop hook fires, a renamed `triage` script runs); `.claude/rules/classifier-lifecycle.md` writer matrix updated (`plan` no longer writes the registry)
- [x] #5 `meta.json` names/path-patterns updated (the planning-only *flow* rewrite + diagram regen is Phase 4)
- [x] #6 No `src/absorb/*` or `triage-coordinator.md` references remain (deleted in Phase 1) — verified by the grep
- [x] #7 `pnpm -r build && pnpm -r test` green; the on-disk base dir is NOT renamed (legacy-name comment added)
<!-- AC:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
## High-level summary

**Why this work exists.** The self-healing pipeline is restructured into a clean `triage → plan` topology where `plan` is planning-only and all registry/file mutation belongs to a deferred actuator. This phase realises that topology mechanically — rename the two skills and strip the curator's code-mutating machinery — staying rename-shaped so it reviews like a rename, not a feature. The planning engine that replaces the stripped machinery is built in Phase 4 (190.22.9).

**What was built.** Two moves. (1) **Rename** via `git mv`: `triage-entrypoints → triage`, `triage-curator → plan`, and the agent `triage-curator-investigator.md → plan-strategist.md` (file rename only — the prompt's classifier-author → strategist role rewrite is Phase 4). Every in-repo reference follows: both `package.json` names, the skill `tsconfig` include globs (relative, no path edits needed), `plan`'s `meta.json` skill/path strings, the in-repo registry path `.claude/skills/triage/known_issues/registry.json` referenced from `packages/core` / `packages/types` / `packages/skill-fs` / `packages/skill-protocol`, the `pnpm-workspace.yaml` globs (with `pnpm install` regenerating the lockfile importer keys), the root `package.json` typecheck/lint globs, `eslint.config.js`, `.gitattributes`, the `.claude/hooks`, and the `agent_prompt_pin.test.ts` pin. The ~64 bundled-core `builtins/check_*.ts` `AUTO-GENERATED` provenance headers are rewritten to a generator-agnostic note (their generator is deleted). (2) **Strip** the code-mutating actuator surface from `plan` (git history is the park): `src/apply/*`, `src/propose/{render_classifier,render_ariadne_bug_body}.ts`, `scripts/sync_permanent_rules.ts`, `src/render_builtins_barrel.ts`, the promotion path (`find_promotion_candidates`, `promotion_candidates`), the drift/observation bookkeeping (`src/absorb/*`), and — because they are the orchestrators whose whole job is driving that machinery — `scripts/finalize_run.ts`, `scripts/link_ariadne_bug_tasks.ts`, and `src/store/curation_outcome.ts`. Two load-bearing symbols are relocated out of the deleted `apply_proposals.ts` before deletion (`SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` → `src/types.ts`; `validate_spec_example_indexes` inlined into its sole caller). Surviving callers (`curate_all.ts`, `propose_backlog_tasks.ts`, `get_investigate_context.ts`, `validate_responses.ts`, the impact reports) are pared to read-and-propose only — `curate_all.ts` loses its `finalize_cmd` and now-meaningless `--dry-run`; dead type definitions are removed from `src/types.ts`. `atomic_update_registry` stays in `@ariadnejs/skill-fs` for the future actuator.

**How to navigate the result.** `plan`'s golden path is now: `scripts/curate_all.ts` (read triage results → partition novel issues into promote/bump/resurface buckets → emit a JSON dispatch plan, writes nothing) → the `plan-strategist` investigator wave (authors `InvestigateResponse` proposals, self-validated by `scripts/validate_responses.ts`) → on-demand `generate_impact_report.ts` / `propose_backlog_tasks.ts`. The write-boundary contract is in `.claude/rules/classifier-lifecycle.md`, whose writer matrix now records `plan` as read-only and the **actuator (deferred)** as the registry writer. `plan/SKILL.md` and `README.md` describe the planning-only skeleton.

**Noteworthy decisions & what to watch.** On-disk `~/.ariadne/{triage-entrypoints,triage-curator}` storage namespaces are deliberately NOT renamed (renaming orphans existing state); they carry canonical legacy-name comments and are the only `triage-entrypoints|triage-curator` tokens the completeness grep returns. These are distinct from `~/.ariadne/plan/` (the Phase-4 task-DB). Review caught one real defect: the line-by-line rename pass mangled two **multiline** `path.join(".ariadne", "triage-entrypoints", …)` on-disk paths (`detect_dead_code.ts` whitelist + `CURATOR_RUNS_DIR`) into `"triage"`/`"plan"`, silently orphaning state — both reverted, and a scan confirms no other multiline on-disk path was affected. Deliberately deferred to Phase 4 (per the task): `meta.json`'s flow/store topology (marked with a `_deferred` field; only names/paths are current), the skill diagrams (the triage per-step `.mmd`/`.svg` still shows the Phase-1-deleted `triage-coordinator` node; the stale pre-strip `plan` diagrams were deleted as orphans), and the agent prompt's role rewrite. Verified: `pnpm -r build && pnpm -r test` green (types 130, skill-protocol 21, skill-fs 17, core 2811, plan 92, mcp 228; triage 254 run directly), typecheck + lint clean, the dead-code and eslint Stop hooks fire post-rename, and a renamed `triage` script runs.
<!-- SECTION:NOTES:END -->
