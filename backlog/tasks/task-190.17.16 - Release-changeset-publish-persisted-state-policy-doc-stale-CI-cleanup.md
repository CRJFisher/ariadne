---
id: TASK-190.17.16
title: "Release: changeset, publish, persisted-state policy doc, stale CI cleanup"
status: To Do
assignee: []
created_date: "2026-04-28 19:21"
updated_date: "2026-04-28 21:27"
labels:
  - release
dependencies:
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Land the breaking-change release. The user-visible API change (`Project.get_call_graph().entry_points` semantics + new `get_classified_entry_points()`) is a major bump; `@ariadnejs/types` is linked to `@ariadnejs/core` in `.changeset/config.json`, so it bumps major along with core.

Companion to TASK-190.17.18, which handles the in-tree state-hygiene work (cache schema bumps, hooks audit, registry `schema_version`). This task is the irreversible side of the cliff: once the changeset publishes, npm versions cannot be unpublished.

## Changeset

ADD: `.changeset/<descriptor>.md` with content:

```md
---
"@ariadnejs/core": major
"@ariadnejs/types": major
---

Move known-false-positive classification into core. Project.get_call_graph().entry_points now returns true positives only by default. Use the new Project.get_classified_entry_points() for triage workflows where you need to see framework-invoked, dunder-protocol, test-only, and indirect-only entry points. The MCP list_entrypoints tool gains a show_suppressed opt-in flag for the same purpose.
```

(Linked bump: even though `@ariadnejs/types` is only renaming, it bumps major to stay in lockstep with `@ariadnejs/core`.)

## Persisted-state preservation policy (release-note language)

Document in the changeset / release note that:

- **Do not** `rm -rf ~/.ariadne/self-repair-pipeline/analysis_output/`. The directory is the permanent source of truth for the TP cache (`triage_results_store.ts:most_recent_finalized_triage_results`, called from `confirmed_unreachable_reuse.ts:derive_tp_cache`). Wiping kills cross-run TP reuse.
- For projects with pre-run-namespaced state, run `migrate_legacy_state.ts --project <name>` (or `--purge` to drop history). Touches only `triage_state/`.
- For stale runs in flight at upgrade time, clear the `LATEST` pointer via `abandon_run.ts` or by deleting the LATEST file. Old run dirs remain visible to `list_runs`.

## Stale CI step

`.github/workflows/test.yml:54` runs `packages/core/agent-validation/ci-validation.ts` — the file doesn't exist on disk. Remove the step (the file was apparently lost in a prior cleanup) or restore it. Bundled into this task because it lands in the same PR window.

## Verification

- `pnpm changeset status` shows the new changeset.
- `pnpm build` and the full test suite pass on the migration branch.
- `.github/workflows/test.yml` passes locally via `act` (or by simulation).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Changeset added for linked @ariadnejs/core + @ariadnejs/types major bump
- [ ] #2 Changeset body documents Project.get_classified_entry_points() and the show_suppressed MCP flag
- [ ] #3 Release note documents the persisted-state preservation policy (do not wipe analysis_output/)
- [ ] #4 Release note documents migrate_legacy_state.ts usage for pre-run-namespaced state
- [ ] #5 Stale CI step at .github/workflows/test.yml:54 removed (or restored if file is recoverable)
- [ ] #6 pnpm changeset status reports the new changeset
- [ ] #7 pnpm build and full test suite pass on the migration branch
- [ ] #8 .github/workflows/test.yml passes (locally via act or in CI)
<!-- AC:END -->
