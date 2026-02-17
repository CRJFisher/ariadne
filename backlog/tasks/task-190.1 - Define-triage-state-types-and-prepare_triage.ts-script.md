---
id: task-190.1
title: Define triage state types and prepare_triage.ts script
status: To Do
assignee: []
created_date: '2026-02-17 16:56'
labels: []
dependencies: []
parent_task_id: task-190
---

## Description

Create the foundation layer: TypeScript interfaces for the triage state file and the deterministic `prepare_triage.ts` script that initializes it. The state file tracks entries through phases (triage → aggregation → meta-review → fix-planning → complete). The prepare script loads analysis JSON, runs `classify_entrypoints()` for registry matching, applies diagnosis-based routing (known-tp, deterministic-fp, llm-triage), builds the state file with correct initial statuses, and creates the `.claude/triage_active` marker.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### State File Schema

**Location**: `entrypoint-analysis/triage_state/{project}_triage.json`

```typescript
interface TriageState {
  project_name: string;
  project_path: string;
  analysis_file: string;
  phase: "triage" | "aggregation" | "meta-review" | "fix-planning" | "complete";
  batch_size: number;
  entries: TriageEntry[];
  aggregation: AggregationResult | null;
  meta_review: MetaReviewResult | null;
  fix_planning: FixPlanningState | null;
  created_at: string;
  updated_at: string;
}

interface FixPlanningState {
  fix_plans_dir: string;  // e.g. "entrypoint-analysis/triage_state/fix_plans"
  groups: Record<string, FixPlanGroupState>;
}

interface FixPlanGroupState {
  group_id: string;
  root_cause: string;
  entry_count: number;
  sub_phase: "planning" | "synthesis" | "review" | "task-writing" | "complete";
  plans_written: number;       // out of 5
  synthesis_written: boolean;
  reviews_written: number;     // out of 4
  task_file: string | null;    // path to backlog task file
}

interface TriageEntry {
  name: string;
  file_path: string;
  start_line: number;
  kind: string;
  signature: string | null;
  route: "known-tp" | "deterministic-fp" | "llm-triage";
  diagnosis: string;                      // from enriched diagnostics
  deterministic_group_id: string | null;  // for deterministic-fp
  known_source: string | null;            // for known-tp
  status: "pending" | "completed" | "failed";
  result: TriageEntryResult | null;
  error: string | null;
  attempt_count: number;
}

interface TriageEntryResult {
  is_true_positive: boolean;
  is_likely_dead_code: boolean;
  group_id: string;
  root_cause: string;
  reasoning: string;
}
```

### prepare_triage.ts Process

**File**: `.claude/skills/self-repair-pipeline/scripts/prepare_triage.ts`

**Inputs**: `--analysis <path>` `--state <path>` `[--package <name>]` `[--batch-size 5]`

1. Load analysis JSON (from `detect_entrypoints.ts`)
2. Load known-entrypoints registry
3. If `--package`: load ground truth, separate known TPs
4. Run `classify_entrypoints()` for registry matching
5. Apply deterministic routing on unclassified entries:
   - `diagnosis="no-textual-callers"` + exported → `route="known-tp"`
   - Constructor → `route="deterministic-fp"`, `group_id="constructor-resolution-bug"`
   - Protected/private → `route="deterministic-fp"`, `group_id="method-call-via-this-not-tracked"`
   - Callback → `route="deterministic-fp"`, `group_id="callback-invocation-not-tracked"`
   - Everything else → `route="llm-triage"` (escape hatch)
6. Build state file: deterministic entries start as `status="completed"`, LLM entries as `status="pending"`
7. Write state file and create `.claude/triage_active` marker

**Reuses**: `classify_entrypoints()` from `entrypoint-analysis/src/classify_entrypoints.ts`, types from `entrypoint-analysis/src/types.ts`

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TriageState, TriageEntry, TriageEntryResult, FixPlanningState, FixPlanGroupState interfaces defined in entrypoint-analysis/src/triage_state_types.ts
- [ ] #2 prepare_triage.ts accepts --analysis, --state, --package, --batch-size flags
- [ ] #3 Deterministic routing: constructors → deterministic-fp, protected/private → deterministic-fp, callbacks → deterministic-fp, exported+no-textual-callers → known-tp, everything else → llm-triage
- [ ] #4 Deterministic entries start as status=completed, LLM entries as status=pending
- [ ] #5 .claude/triage_active marker file created containing path to state file
- [ ] #6 Unit test: run on known analysis JSON, verify correct entries, routes, and statuses
<!-- AC:END -->

## Implementation Plan

1. Create entrypoint-analysis/src/triage_state_types.ts with all interfaces from the plan's State File Schema section
2. Create .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts
3. Reuse classify_entrypoints() from entrypoint-analysis/src/classify_entrypoints.ts
4. Implement diagnosis-based routing logic for unclassified entries
5. Write state file to entrypoint-analysis/triage_state/{project}_triage.json
6. Add triage_state/ to entrypoint-analysis/.gitignore
7. Test with existing analysis JSON from a previous self-analysis run
