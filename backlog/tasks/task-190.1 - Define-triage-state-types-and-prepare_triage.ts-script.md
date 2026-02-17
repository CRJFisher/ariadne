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

Create the foundation layer: TypeScript interfaces for the triage state file and the deterministic prepare_triage.ts script that initializes it. The state file tracks entries through phases (triage → aggregation → meta-review → fix-planning → complete). The prepare script loads analysis JSON, runs classify_entrypoints() for registry matching, applies diagnosis-based routing (known-tp, deterministic-fp, llm-triage), builds the state file with correct initial statuses, and creates the .claude/triage_active marker.

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
