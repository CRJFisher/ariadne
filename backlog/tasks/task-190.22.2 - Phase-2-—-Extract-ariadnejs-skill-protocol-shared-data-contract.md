---
id: TASK-190.22.2
title: Phase 2 — Extract @ariadnejs/skill-protocol shared data contract
status: To Do
assignee: []
created_date: '2026-06-01 10:45'
updated_date: '2026-06-01 14:52'
labels:
  - self-repair
  - data-contract
  - packages
dependencies:
  - TASK-190.22.1
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The two skills coordinate entirely by filesystem convention, which is brittle: the published-results schema version is duplicated (`triage-entrypoints/src/finalize/output.ts:22` `FINALIZATION_OUTPUT_SCHEMA_VERSION = 4` vs `triage-curator/src/types.ts:94` `TRIAGE_RESULTS_SCHEMA_VERSION = 4`), the `TriageResultsFile` shape is hand-redeclared on both sides (with two incompatible `MemberEvidence` shapes), the registry path is resolved by fragile traversal in two places (`known_issues_registry.ts:67-70` and curator `store/paths.ts:22-26`), and run-ids are unvalidated strings derived by `path.basename`/`dirname` magic (`scan_runs.ts:81-114`). One typed contract module fixes all of this.

## Decision — new private package, NOT folded into `@ariadnejs/types`

`@ariadnejs/types` is a published, public npm package; the `~/.ariadne` filesystem protocol + run-id grammar are private inter-skill plumbing and must not leak into a semver-governed public API. Create `packages/skill-protocol` (`@ariadnejs/skill-protocol`, `private: true`) — the type-level twin of the existing private `@ariadnejs/skill-fs`. Use `packages/skill-fs/{package.json,tsconfig.json}` as the template. It depends on `@ariadnejs/types` (for `KnownIssue`/`ClassifierRegressionFlag`).

## Contents

- `src/triage_results.ts` — one canonical `TriageResultsFile` merging the two declarations; single `TRIAGE_RESULTS_SCHEMA_VERSION`. **Collapse `MemberEvidence` onto `{ file, line, why }`** (the producer's real shape from `triage_verdict.ts:18-22`); the curator's `{ summary, excerpt }` is a phantom never written. Move the strict parser (`read/parse_v4_triage_results` from curator `parse_triage_results.ts:27-70`) here so producer and consumer validate identically. Carry the deterministic FP fault diagnostics (`diagnosis`, `resolution_failure {stage,reason}`, `receiver_kind`) on FP rows by **reusing** the `@ariadnejs/types` enums (no duplication), and relocate the `NovelIssue`/`NovelIssueCitation`/`MemberEvidence` types here (moved locally in Phase 1).
- `src/run_id.ts` — branded `RunId`, `RUN_ID_REGEX`, `build_run_id(short_commit)` (replaces `prepare_triage.ts:151-153`), `parse_run_id`/`is_run_id`.
- `src/paths.ts` — `analysis_output_dir()`, `triage_results_path(project, run_id)` + inverse `parse_triage_results_path()`, and `known_issues_registry_path()` (the one function that kills BOTH traversal sites). Preserve the `ARIADNE_*_OVERRIDE` env-var contract (read lazily); anchor repo-root on `pnpm-workspace.yaml`, not a hardcoded `..` count. DO NOT move `RunManifest` (producer-private scratch) or curator-private run-state paths.

## Migration (no shims — update every caller, delete the local declaration)

Key sites: `output.ts:22,31-103`, `triage_verdict.ts:18-22`, `prepare_triage.ts:151-153`, both `store/paths.ts`, `known_issues_registry.ts:67-70`, curator `types.ts:16-94`, `parse_triage_results.ts:20-76`, `scan_runs.ts:5,34-39,111-114`.

## Build wiring

Package `name`/`exports`/`build` + `references:[{path:"../types"}]`; add `{path:"./packages/skill-protocol"}` to root `tsconfig.json`; insert its build between `types` and `core` in root `package.json` build script; add `@ariadnejs/skill-protocol: workspace:*` to both skills' `package.json`; `pnpm install`. Skills run under tsx but resolve workspace deps via `dist/` symlinks, so the package MUST build to `dist/` first (same as skill-fs).

## Non-goal

Do NOT introduce a new hand-designed fault-area taxonomy/enum here. The FP fault signal carried in the contract is the existing deterministic enums (`diagnosis`/`resolution_failure`) + free-text `proposed_root_cause`. The `AriadneFaultArea` type lives in `@ariadnejs/types` (TASK-190.22.4), not this package; this phase stays mechanical (consolidate the shape that exists).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New private `packages/skill-protocol` (`@ariadnejs/skill-protocol`) exists with `src/{triage_results,run_id,paths}.ts` + barrel; depends on `@ariadnejs/types`; builds to `dist/`
- [ ] #2 `TRIAGE_RESULTS_SCHEMA_VERSION` and the `TriageResultsFile` type exist once in the package; both skills import them and the two duplicate local declarations are deleted
- [ ] #3 `MemberEvidence` is collapsed onto `{ file, line, why }` everywhere; the curator's `{ summary, excerpt }` shape is removed
- [ ] #4 `known_issues_registry_path()` is the single registry-path resolver; both `../../../`-style traversal sites are deleted and import it
- [ ] #5 Run-id has a branded type + `build_run_id`/`parse_run_id`/`RUN_ID_REGEX`; curator basename/dirname magic is replaced by `parse_triage_results_path`/`parse_run_id` and throws on malformed names
- [ ] #6 Colocated package tests: producer-shaped `TriageResultsFile` round-trips through the parser (deep-equal + `satisfies`); a `schema_version:3` fixture throws; run-id + registry-path round-trips pass
- [ ] #7 `pnpm build` (correct dist ordering), `pnpm typecheck`, `pnpm test`, `pnpm lint` are green; `triage-entrypoints/src/store/paths.test.ts` (the `*_OVERRIDE` isolation contract) still passes
- [ ] #8 No backwards-compat shims; every caller updated to the shared package
- [ ] #9 The canonical `TriageResultsFile` carries the deterministic FP fault diagnostics (`diagnosis`, `resolution_failure {stage,reason}`, `receiver_kind`) by reusing the `@ariadnejs/types` enums — no duplicated enum definitions
- [ ] #10 `NovelIssue`/`NovelIssueCitation`/`MemberEvidence` live in `@ariadnejs/skill-protocol` (relocated from their Phase-1 local home); both skills import them
- [ ] #11 Explicit non-goal honored: NO new fault-area taxonomy/enum is added to the contract in this phase; the `AriadneFaultArea` type lives in `@ariadnejs/types` (TASK-190.22.4), not this package
<!-- AC:END -->
