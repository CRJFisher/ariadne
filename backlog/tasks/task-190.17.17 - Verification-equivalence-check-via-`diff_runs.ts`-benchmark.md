---
id: TASK-190.17.17
title: "Verification: equivalence check via `diff_runs.ts` + benchmark"
status: To Do
assignee: []
created_date: "2026-04-28 19:21"
updated_date: "2026-04-28 21:26"
labels:
  - verification
dependencies:
  - TASK-190.17.16
  - TASK-190.17.18
parent_task_id: TASK-190.17
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

End-to-end validation that the migration shipped without behavioral drift. Three checks: classification equivalence, performance, and a live MCP smoke test.

## Equivalence check (the load-bearing one)

Pick a representative project on a fixed commit. Before and after the structural moves land, run the full pipeline:

```bash
# pre-migration baseline (run on a worktree at the commit before TASK-190.17.6 ships)
pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts \
  --config <project_config>
pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts \
  --analysis <baseline_analysis_path> --project <name>
# ... triage, finalize → produces analysis_output/<name>/triage_results/<pre_run_id>.json

# post-migration (current branch, .6 has shipped)
pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts \
  --config <project_config>
pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts \
  --analysis <post_analysis_path> --project <name>
# ... triage, finalize → <post_run_id>.json

# diff
pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/diff_runs.ts \
  --project <name> --from <pre_run_id> --to <post_run_id> --format text
```

**Expected**: zero `flipped` verdicts (no entry_point that was TP becomes FP or vice versa); minimal group churn (only entry_points newly matching the registry-driven dunder rule should move).

The TP cache is irrelevant for this check because both runs share the same commit prefix; the pre-run will be the cache source for the post-run, surfacing the migration's effect on classification rather than on re-investigation.

## Performance benchmark

Run `Project.get_call_graph()` on the largest fixture both pre- and post-migration. Measure wall-clock time. **Acceptable**: ≤25% slowdown. If exceeded, the `EnrichedCallGraph` cache likely isn't hitting — check the `(call_graph_hash, registry_hash)` key.

The classifier itself is ~50-200ms for a 200-entry-point project (predicate evaluation + ~150 file reads), so the regression should be in that range, not seconds.

## Live MCP smoke test

Run an end-to-end MCP session asking for entry points on a Flask project (the headless skill, `mcp-headless-test`, makes this easy). Confirm:

- Default `list_entrypoints` returns no `@app.route` handlers.
- `list_entrypoints({show_suppressed: true})` reveals the routes with `[framework-flask-route: flask]` tags.
- `pytest`-decorated fixtures behave the same way (suppressed by default, surfaced under `show_suppressed`).
- Python dunders (`__str__`, etc.) are suppressed by default.

## Verification artifacts

Capture and post the following to the parent task (190.17) before marking it complete:

- `diff_runs.ts` text output showing zero flipped verdicts.
- Benchmark numbers (pre vs post wall-clock + variance).
- A snippet of MCP `list_entrypoints` output for a Flask fixture (default + `show_suppressed: true`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 diff_runs.ts pre/post on a fixed commit shows zero flipped verdicts
- [ ] #2 Group churn limited to expected dunder-rule migration
- [ ] #3 Benchmark Project.get_call_graph() on largest fixture: ≤25% slowdown post-migration
- [ ] #4 Live MCP smoke test on Flask fixture confirms default-clean output
- [ ] #5 list_entrypoints({show_suppressed: true}) reveals route handlers with [group_id: framework] tags
- [ ] #6 pytest fixtures and Python dunders correctly suppressed by default
- [ ] #7 Verification artifacts (diff output, benchmark numbers, MCP snippet) posted to TASK-190.17
- [ ] #8 packages/core/src/project/project.bench.test.ts and packages/core/src/persistence/persistence.bench.test.ts re-baselined: pre/post wall-clock numbers recorded; ≤25% slowdown asserted as a regression guard
<!-- AC:END -->
