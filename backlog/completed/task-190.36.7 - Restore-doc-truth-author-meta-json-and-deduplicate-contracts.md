---
id: TASK-190.36.7
title: "Restore doc truth, author meta.json, and de-duplicate contracts"
status: Done
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

- [x] No pipeline doc asserts a gitignore rule, export invocation, or writer
      set that the code contradicts (spot-checked by re-running the review's
      verification commands).
- [x] `plan/meta.json` contains no ghost store, no stale wiring note, full
      path patterns, and named intentions; the three new meta.json files
      exist in the union shape.
- [x] `check_triage_results.ts` and `check_registry.ts` pass on current
      artifacts and fail on a seeded malformed fixture.
- [x] Triage's architecture table paths all resolve on disk.
- [x] Each Theme-7 contract (verdict shape, name-mode, routing, strategist
      rules, cache leaks) exists verbatim in exactly one owning surface, with
      pointers elsewhere.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The pipeline's loop-closure model rests on the operator trusting what the docs
assert about write boundaries; this task makes every such assertion match the
code, gives the two skills without one a `meta.json` contract, adds the lint
lenses the review asked for, and collapses each duplicated contract to a single
owning surface.

**Doc truth.** Comprehension staging docs are tracked in the repo, not
gitignored — the `.gitignore` rule is removed and `prioritize/SKILL.md` and
`plan/src/store/paths.ts` now say "staged, uncommitted until graduation moves a
funded cluster's doc; unfunded ones deleted," so a failed graduation stays
visible in `git status`. (This resolves a direct conflict: TASK-190.36.1 had
*added* that gitignore rule to match the docs; .7 takes the opposite,
operator-confirmed resolution.) `plan/SKILL.md`'s stale export section — which
documented an invocation the code hard-refuses — is rewritten to point at
`prioritize` (the contract owner) and `export_to_backlog.ts`'s already-accurate
docstring, and states the real contract (a write requires `--assignments` +
`--write`; a bare invocation throws; `--dry-run` previews). Every "only writer of
`backlog/`" claim becomes the two-named-writers wording:
`export_to_backlog.ts` is the only writer of `backlog/tasks/*.md` cards;
`graduate_group_docs.ts` moves graduated comprehension docs (`.overview.html`)
alongside them.

**Contracts.** `plan/meta.json` loses its ghost `registry-read` store, drops the
stale "NOT YET WIRED" note (the `backlog/tasks` dedup read *is* wired via
`reconcile_plan.ts`), gains the `~/.ariadne/triage-entrypoints/` path prefix, and
gains `effects: "repo-local"` plus four named, test-backed intentions. New
`meta.json` files for `triage`, `prioritize`, and `reconcile-registry` follow the
union shape (skill-diagrammer schema plus the sr-review `intentions`/`effects`/
`flows[].exit` fields), each declaring flows, stores, sub-agents, published
outputs, and downstream consumers with cross-skill producer/consumer edges
reciprocated.

**Lint lenses.** `check_triage_results.ts` strict-parses the published v5
envelope by reusing `parse_triage_results`; `check_registry.ts` layers three
cross-checks on `validate_registry` — `function_name ∈ BUILTIN_CHECKS`, a present
`observed_count >= 1`, and no `drift_detected` on a `fixed` row. Both follow the
usage→2 / fail→1 / ok→0 convention, live beside `reconcile_registry.ts` under
`triage/scripts/` (clean in-skill and workspace imports, no forbidden cross-skill
sibling path), and carry fixture tests that pass on current artifacts and fail on
seeded malformed input.

**Architecture table & de-dup.** Triage's architecture table gains the `src/`
subdirectory on the six mislisted modules (`finalize/`, `verdict/`, `store/`,
`dispense/`), so every path resolves. Each Theme-7 contract now lives in exactly
one owner with pointers elsewhere: the `TriageVerdict` shape in
`templates/prompt.md` (the JSON blocks are gone from the investigator agent,
which keeps its decision logic); reconcile name-mode in `reconcile-registry`
SKILL step 4; permanent-limitation routing in `prioritize` intro + step 3a; the
strategist's rule clusters in `plan-strategist.md` (whose membership section now
documents the three-way `belongs: true | false | "unsure"` matching
`validate_plan.ts`, with the Pass B dispatch prompt reduced to bindings); and the
TP-cache leaks in one statement.

### Noteworthy decisions and scope notes

- **Gitignore conflict.** TASK-190.36.1 and .7 resolved the same doc/code
  inconsistency in opposite directions. .1 (already landed) added the gitignore
  rule; .7 removes it and makes the docs say tracked-not-gitignored. The operator
  chose .7's resolution — staging docs stay visible in `git status` so a failed
  graduation is not silently stranded.
- **Validator placement.** The task named
  `reconcile-registry/scripts/check_registry.ts`, but both validators live under
  `triage/scripts/` beside `reconcile_registry.ts` itself (the reconcile tooling
  already lives there). This keeps imports of `triage/src` and `@ariadnejs/core`
  clean and avoids a forbidden cross-skill sibling import.
- **Item 7 (optional).** Done as a light in-file dedup — the Pre-flight File
  Count Check section now owns the ~4,000-file threshold and the config-authoring
  step points at it — rather than the heavier "extract to reference files"
  restructuring, per YAGNI.
- **Commit boundary.** A concurrent registry-write-guard refactor (removing the
  guard's Bash interception) was present, uncommitted, in the working tree. This
  task's files were committed separately (`docs(190.36.7)`, `6777f179`), leaving
  those guard files — and `classifier-lifecycle.md`, which the two changes share
  — for that refactor's own commit. The item-6b name-mode de-dup edit to
  `classifier-lifecycle.md:76` therefore lands with the guard refactor's commit,
  not this one.
- **Verification.** typecheck (triage + plan) and eslint clean; the validators
  were driven end-to-end (pass on the live registry and a real triage_results
  file; fail on seeded malformed fixtures; usage error exits 2); triage skill
  vitest 413 + the new validator tests (17), plan 251, and the skill-fs registry
  write-boundary AST scan all pass. A 7-lens review plus a two-round fix-diff
  re-review drove a batch of fixes: the `--project` sweep now fails on a missing
  results dir instead of passing vacuously, `check_registry` reports a missing
  `--file` as a structured issue, the cross-skill consumer graph in the meta.json
  files is reciprocated, and coverage was added for the sweep, multi-rule,
  boundary, and empty-registry paths.
