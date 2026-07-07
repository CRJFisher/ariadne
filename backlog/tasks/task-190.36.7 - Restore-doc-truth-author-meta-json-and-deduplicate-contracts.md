---
id: TASK-190.36.7
title: "Restore doc truth, author meta.json, and de-duplicate contracts"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
parent_task_id: TASK-190.36
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Lands strictly after TASK-190.36.1–.6: the contract de-duplication rewrites
the same SKILL sections the behavior-changing sub-tasks edit, so every
surviving canonical copy is written once. The pipeline's loop-closure model
depends on the operator trusting what the docs assert about write
boundaries — the false claims go first.

### Work

1. **Kill the false safety claims.**
   - The `*.comprehension.html` gitignore claim
     (`prioritize/SKILL.md:329,430-431`; `plan/src/store/paths.ts:125-137`
     docstring) — the rule does not exist. Delete the claim rather than add
     the rule: gitignoring the staging docs would hide a failed graduation
     and the operator is told to open them from the tree. State the truth:
     staged in-repo, uncommitted until graduation moves a funded cluster's
     doc; delete unfunded ones.
   - Rewrite `plan/SKILL.md:160-190`'s export section to a pointer at
     prioritize as the contract owner — today it documents an invocation the
     code hard-refuses (`--assignments` required, never mentioned). Keep only
     the write-boundary fact.
   - Correct `export_to_backlog.ts:14-16`'s docstring: a bare invocation
     throws; preview requires explicit `--dry-run` (or the post-190.36.4
     render-preview semantics).
   - Replace the "only writer of backlog/" claims (`plan/SKILL.md:213`,
     `prioritize/SKILL.md:3,29,128`, `export_to_backlog.ts:46`) with the
     two-named-writers wording decided in TASK-190.36.2, verbatim:
     "`export_to_backlog.ts` is the only writer of `backlog/tasks/*.md`
     cards; `graduate_group_docs.ts` moves graduated comprehension docs
     alongside them." No backlog AST test backs this boundary —
     `export_to_backlog.ts` writes distinct per-task files and
     `graduate_group_docs.ts` renames distinct files, so there is no
     shared-file race for structural enforcement to protect.
2. **Fix plan/meta.json** (the exemplar the new files copy): delete the ghost
   `registry-read` store (`:54-60`), drop the stale "NOT YET WIRED" on
   `backlog-read` (wired at `reconcile_plan.ts:27,85`), prefix both
   `path_pattern`s with `~/.ariadne/triage-entrypoints/`, and add
   `effects: "repo-local"` plus `intentions[]` naming the four test-backed
   invariants (write boundary, augment-not-duplicate, partial-sweep safety,
   permanent-never-exported). Author intentions that depend on .3/.4
   deliverables only after those land.
3. **Author meta.json for triage, prioritize, reconcile-registry** in the
   union shape (skill-diagrammer schema + the sr-review `intentions[]`/
   `effects`/`flows[].exit` fields — additive-compatible). Declare each
   skill's flows, stores (registry as read-only for triage; write-owned for
   reconcile), sub-agents, published outputs, and downstream consumers.
4. **Give the lint lens real validators**: `triage/scripts/
check_triage_results.ts` (strict-parse the published v5 envelope, reusing
   the finalize parser) and a thin `reconcile-registry/scripts/
check_registry.ts` (strict-parse rows, `function_name ∈ BUILTIN_CHECKS`,
   `observed_count >= 1`, no `drift_detected` on `fixed` rows). Exit
   convention per TASK-190.36.6.
5. **Correct triage's architecture table** — six rows gain their `src/`
   subdirectory (`src/finalize/merge_results.ts`,
   `src/verdict/triage_verdict.ts`,
   `src/finalize/confirmed_unreachable_reuse.ts`,
   `src/store/run_discovery.ts`, `src/store/analysis_output.ts`,
   `src/dispense/dispense_payload.ts`). The `src/cross_run/` placement from
   the review's orchestration variant is wrong; these are the verified paths.
6. **De-duplicate contracts to single owners** (mechanical, last):
   - TriageVerdict shape → `templates/prompt.md` + the parser own it; delete
     the JSON blocks from `triage-investigator.md:53-84` and the SKILL shape
     restatement (the shape currently ships twice in-context on every one of
     75+ dispatches).
   - Reconcile name-mode → SKILL step 4 canonical; collapse the other three
     restatements (and `classifier-lifecycle.md:76`) to pointers.
   - Prioritize permanent-limitation routing → state twice (intro + step
     3a), pointing at the `verdict.json` contract from TASK-190.36.4;
     delete the other four restatements.
   - Plan dispatch prompt → bindings only; `plan-strategist.md` owns the
     rule clusters (including the new `belongs: 'unsure'` semantics).
   - TP-cache leak warnings → single statement (keep `triage/SKILL.md:267`,
     plus the dedup_key leak note from TASK-190.36.5 following the same
     pattern).
7. **Optional**: extract triage's inline config-authoring and file-count
   preflight sections to reference files; state the ~4,000-file heuristic
   once.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] No pipeline doc asserts a gitignore rule, export invocation, or writer
      set that the code contradicts (spot-checked by re-running the review's
      verification commands).
- [ ] `plan/meta.json` contains no ghost store, no stale wiring note, full
      path patterns, and named intentions; the three new meta.json files
      exist in the union shape.
- [ ] `check_triage_results.ts` and `check_registry.ts` pass on current
      artifacts and fail on a seeded malformed fixture.
- [ ] Triage's architecture table paths all resolve on disk.
- [ ] Each Theme-7 contract (verdict shape, name-mode, routing, strategist
      rules, cache leaks) exists verbatim in exactly one owning surface, with
      pointers elsewhere.

<!-- AC:END -->
