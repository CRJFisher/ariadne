---
id: TASK-190.16.6
title: "Create triage-curator skill scaffold (scan runs, curator state, CLI options)"
status: Done
assignee: []
created_date: "2026-04-17 14:39"
completed_date: "2026-04-22"
labels:
  - triage-curator
  - skill
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/self-repair-pipeline/
  - /Users/chuck/.ariadne/self-repair-pipeline/analysis_output/
parent_task_id: TASK-190.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase F1 + F2 + F3.

Create the new `triage-curator` skill that sweeps completed self-repair-pipeline runs and feeds improvements back into the registry, the backlog, and (where new code is needed) the codebase. This task scaffolds the skill and implements the run-discovery + state + CLI layers. The LLM-powered QA and investigation work live in the next task.

**Skill layout:**

```
.claude/skills/triage-curator/
├── SKILL.md                       # how and when to invoke
├── README.md
├── scripts/
│   ├── scan_runs.ts               # enumerate un-curated runs
│   ├── curate_run.ts              # curate one run (calls into F4 dispatchers)
│   └── curate_all.ts              # default entry: sweep un-curated runs
├── src/
│   ├── curation_state.ts          # load/persist ~/.ariadne/triage-curator/state.json
│   └── types.ts
└── reference/
    └── signal_inventory.md         # enumeration of deterministic signals (rendered from registry + introspection APIs)
```

**State file schema** (`~/.ariadne/triage-curator/state.json`):

```typescript
interface CuratorState {
  curated_runs: Array<{
    run_id: string; // triage-results JSON timestamp
    project: string;
    run_path: string;
    curated_at: string;
    outcome: {
      qa_groups_checked;
      qa_outliers_found;
      investigated_groups;
      classifiers_proposed;
      backlog_tasks_proposed: string[];
    };
  }>;
}
```

**CLI options:** `--project <name>`, `--last <n>`, `--run <path>`, `--dry-run`, `--reinvestigate`. Default behavior: scan `~/.ariadne/self-repair-pipeline/*/triage_results/*.json`, diff against `CuratorState.curated_runs`, process un-curated runs in chronological order.

No LLM dispatch at this stage — `curate_run.ts` contains stub hooks that the next task fills in. The LLM dispatchers and `templates/` directory (`prompt_group_qa.md`, `prompt_group_investigate.md`) are added by TASK-190.16.7. Reporting scripts (`generate_impact_report.ts`, `propose_backlog_tasks.ts`) are added by TASK-190.16.12.

**Curator invocation boundary:** the curator is run explicitly (manually, on cron, or in CI on a regular cadence). Running the self-repair-pipeline does NOT trigger the curator automatically. The two skills communicate solely through files on disk (pipeline triage output → curator reads).

**`signal_inventory.md` content:** enumerates the six signal categories available to classifiers and to the opus investigator:

1. `CallReference.resolution_failure.{stage, reason}` values (Phase A1)
2. `CallReference.receiver_kind` values (Phase A2)
3. `CallReference.syntactic_features.*` flags (Phase A2)
4. Tree-sitter capture presence/absence at grep hits (`has_capture_at_grep_hit` / `missing_capture_at_grep_hit`)
5. Decorator patterns on `CallableNode.definition.decorators` (Axis C)
6. Ariadne introspection APIs (`explain_call_site`, `list_name_collisions`) from Phase A3

The inventory must also carry a **"Known API caveats"** subsection so classifier authors see the constraints before they write predicates against these signals. At minimum:

- **Chained calls are not individually addressable by `(line, column)`.** For expressions like `factory().run()`, the outer `.run()` call and inner `factory()` call share an identical `(start_line, start_column)` — tree-sitter assigns the outer call-expression node the start position of its leftmost descendant. `explain_call_site(file, line, col)` returns a single first-match `CallReference`, so the outer call in a chain is unreachable through this API. Classifiers that must observe the outer call (notably `method-chain-dispatch`, which keys on `receiver_kind === "call_chain"` on the outer method call) must iterate `project.resolutions.get_calls_for_file(file)` directly and filter by `call_type` / `call_site_syntax.receiver_kind`.

- **`ResolutionFailureReason` values observed in practice are a subset of the full union.** Reasons produced by deep sub-stages in `method_lookup.ts` (`import_unresolved`, `reexport_chain_unresolved`, `polymorphic_no_implementations`) are frequently short-circuited by the earlier `name_resolution` stage emitting `name_not_in_scope`. A classifier predicate keyed on `resolution_failure_reason_eq "import_unresolved"` against a clean integration input will often miss — the same logical failure arrives tagged `name_not_in_scope`. Implication: draw classifier fixtures from real project runs (e.g. webpack triage output), not from minimal-TS snippets that short-circuit. The authoritative coverage for deep reasons lives in unit tests on `resolve_method_on_type`, not integration tests on `explain_call_site`.

Re-verify both caveats against the current `packages/core/src/introspection/explain_call_site.ts` docstring when rendering the inventory — this section is load-bearing for any classifier that uses these signals, and must not drift from the API.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `.claude/skills/triage-curator/` directory exists with the layout above
- [x] #2 `scripts/scan_runs.ts` correctly enumerates un-curated runs and respects `--project`, `--last`, `--run` filters
- [x] #3 `src/curation_state.ts` loads + persists `~/.ariadne/triage-curator/state.json` idempotently
- [x] #4 `reference/signal_inventory.md` is generated from the registry + introspection API surface (can be a render script or hand-maintained-but-checked-in at this stage), and includes a "Known API caveats" subsection covering the chained-call `(line, column)` non-addressability and the `ResolutionFailureReason` short-circuit behaviour documented on `explain_call_site`
- [x] #5 Unit tests cover: empty state, all-curated state, partial state, and `--reinvestigate` re-processing of `wip`-status entries whose example set has grown since the last curation
- [x] #6 Running `curate_all --dry-run` on an empty state against the existing webpack triage output lists the runs that would be curated without writing anything
<!-- AC:END -->

## Implementation Notes

Shipped in commit `f5d0edde` (scaffold) and extended in `7dd43d65` (builtin authoring).

Layout deviations from the task description:

- `scan_runs` lives in `src/scan_runs.ts` as a pure module; the CLI surface is folded into `scripts/curate_all.ts` rather than a standalone `scripts/scan_runs.ts`. This makes the run-diff logic directly unit-testable (`src/scan_runs.test.ts`, 14 tests) without filesystem fakes in the CLI layer.
- `CurationOutcome` grew beyond the initial schema to carry investigator-session telemetry: `wip_group_example_counts: Record<string, number>` (snapshot of `wip`-status group sizes at curation time — the data source for `--reinvestigate` growth detection), plus `success_count`, `failure_count`, `blocked_count`, and per-group `failed_groups[]` detail. Shape lives in `src/types.ts:52-80`.
- `ScanResultItem` carries `reason: "uncurated" | "reinvestigate"` and `wip_groups_with_growth: string[]`; `diff_runs_against_state` compares a supplied `current_wip_counts` map against each curated run's `wip_group_example_counts` to surface the growth set.

Supporting modules shipped alongside the scaffold:

- `src/compute_wip_counts.ts` — reduces the known-issues registry to `{ [group_id]: entries_count }` for `wip`-status entries. Fed into `scan_runs` for the `--reinvestigate` diff.
- `src/detect_drift.ts` — `DRIFT_OUTLIER_RATE_THRESHOLD = 0.15`; pure function used by the finalize phase in TASK-190.16.7.
- `src/paths.ts` / `src/errors.ts` / `src/require_node_import_tsx.ts` — shared constants, ENOENT helper, and the guard that ensures every CLI script is launched via `node --import tsx` (prevents `.ts` execution surprises).

`reference/signal_inventory.md` is hand-maintained (checked into the repo, not render-generated) and includes the full predicate-DSL operator table, a "Builtin-only SignalCheck ops" subsection covering the four ops that require builtin context (`name_matches`, `file_path_matches`, `callers_count_at_least`, `callers_count_at_most`), and the "Known API caveats" subsection on chained-call `(line, column)` non-addressability and `ResolutionFailureReason` short-circuiting.
