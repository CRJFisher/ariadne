---
id: TASK-190.16.5
title: Build auto_classify pipeline stage with predicate DSL evaluator
status: Done
assignee: []
created_date: "2026-04-17 14:38"
completed_date: "2026-04-20"
labels:
  - self-repair
  - auto-classifier
  - pipeline
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts
  - .claude/skills/self-repair-pipeline/scripts/get_entry_context.ts
  - .claude/skills/self-repair-pipeline/src/build_triage_entries.ts
  - .claude/skills/self-repair-pipeline/templates/prompt.md
  - .claude/skills/self-repair-pipeline/scripts/get_next_triage_entry.ts
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase C1 + C3.

Create the `src/auto_classify/` module inside the self-repair-pipeline skill. It runs between `extract_entry_points` and `build_triage_entries`, loads the registry, dispatches classifiers in priority order (first-match with confidence gate ≥ 0.9), and emits per-entry `AutoClassifyResult`.

Contract:

```typescript
type Classifier = (input: {
  entry: EnrichedFunctionEntry;
  project: Project;
}) => ClassifierOutput;
interface ClassifierOutput {
  matched: boolean;
  group_id?: string;
  confidence?: number;
  reasoning?: string;
}
interface AutoClassifyResult {
  auto_classified: boolean;
  auto_group_id?: string;
  classifier_hints?: Array<{ group_id; confidence; reasoning }>; // sub-threshold matches — still route to agent
}
```

Includes a `predicate_evaluator.ts` that walks the structured `PredicateExpr` DSL from the registry (no eval). The evaluator must cover all 12 operators enumerated in TASK-190.16.4: combinators (`all`, `any`, `not`) and leaves (`diagnosis_eq`, `language_eq`, `decorator_matches`, `has_capture_at_grep_hit`, `missing_capture_at_grep_hit`, `grep_line_regex`, `resolution_failure_reason_eq`, `receiver_kind_eq`, `syntactic_feature_eq`). Unknown operators error at parse time.

**Composition rules:** priority-ordered first-match with confidence gate. Priority is derived from registry entry order — editors control precedence by reordering `registry.json`. A match ≥ `min_confidence` auto-classifies and short-circuits. A below-threshold match attaches a `classifier_hint` and does NOT short-circuit — the entry still routes to the agent, never losing signal.

Wire into `scripts/prepare_triage.ts`: after (or replacing) the existing `filter_known_entrypoints()` call, invoke `auto_classify()`, mark auto-classified entries to skip dispatch, render `classifier_hints` via `get_entry_context.ts` + `DIAGNOSIS_HINTS` into the single `templates/prompt.md`.

**`--max-count` semantics fix**: the cap applies only to agent-triaged residuals, not to auto-classified entries. A run with `--max-count 20` against 1000 flagged entries must still auto-classify all 1000 then route the first 20 of the residual to the agent. Verify in `prepare_triage.ts`, `build_triage_entries.ts`, `get_next_triage_entry.ts`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `.claude/skills/self-repair-pipeline/src/auto_classify/{auto_classify,predicate_evaluator,types}.ts` exist with tests
- [x] #2 `auto_classify()` returns per-entry results with correct `auto_classified` flag and `classifier_hints` attached for sub-threshold matches
- [x] #3 Predicate DSL evaluator covers all 12 operators enumerated in the description and rejects unknown operators at parse time
- [x] #4 `prepare_triage.ts` invokes `auto_classify()` and writes state with per-entry `auto_classified` flag
- [x] #5 `get_entry_context.ts` renders a new `{{classifier_hints}}` placeholder in `templates/prompt.md`; `DIAGNOSIS_HINTS` entries include classifier-hint rendering language
- [x] #6 End-to-end: running with `--max-count 20` on a ≥100-entry project auto-classifies all entries (verified in TriageState JSON) and routes at most 20 of the residual to the agent
- [x] #7 Priority ordering: first-match wins against registry entry order; below-threshold matches attach `classifier_hints` AND fall through to the agent (both behaviours asserted by unit tests)
- [x] #8 `get_next_triage_entry.ts` skips entries where `auto_classified === true`
<!-- AC:END -->

## Implementation Notes

Shipped in commit `dd10c27e`.

Module layout follows the folder-module convention (folder name == main-module name, no prefix on siblings):

- `src/auto_classify/` — `auto_classify.ts`, `predicate_evaluator.ts`, `types.ts` (+ colocated `.test.ts` files).
- `src/prepare_triage/` — `prepare_triage.ts` (three-bucket orchestrator), `prepare_triage.test.ts`. The CLI entry point `scripts/prepare_triage.ts` is now a thin wrapper over this pure core, which makes the bucket logic unit-testable without touching the filesystem.

Key decisions landed in the shipped code:

- `ClassifierHint` lives in `src/triage_state_types.ts` (persisted state), not in `auto_classify/types.ts`. The `auto_classify` module re-exports it.
- Predicate `min_confidence` is always `1.0` at evaluation time (predicates are binary); sub-threshold hints exist as a code path so TASK-190.16.6 builtin scoring classifiers can reuse it without schema churn.
- Residual sampling is deterministic: `(tree_size desc, file_path asc, start_line asc)` — replaces the previous `Math.random` shuffle. Covered by `sort_residual_entries` tie-break test.
- Registry load-time hardening: regexes pre-compiled, `syntactic_feature_eq.name` validated against `SYNTACTIC_FEATURE_NAMES`, all errors carry the offending `group_id`.
- Preemption warning: `auto_classify()` emits one stderr line per run the first time a permanent builtin-kind issue precedes a matching predicate — guards against priority drift when TASK-190.16.6 wires builtins.
- `GrepHit.captures: string[]` populated eagerly in `gather_diagnostics()` via `explain_call_site` + `CAPTURE_NAMES_BY_CALL_TYPE` mapping; `CallRefDiagnostic` carries `receiver_kind`, `resolution_failure`, `syntactic_features` for the evaluator.
