---
id: task-epic-11.175.2
title: Resolve remaining callback invocation tracking gaps
status: To Do
assignee: []
created_date: '2026-01-28'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-epic-11.175
---

## Description

Anonymous callback functions passed as arguments to other functions appear as false positive entry points because Ariadne does not track indirect callback invocations. When a lambda or anonymous function is passed to `sorted()`, `filter()`, `map()`, or similar higher-order functions, the call graph has no edge from the higher-order function to the callback body.

task-epic-11.172 previously addressed callback invocation tracking for internal functions (TypeScript-focused) and is marked Done. However, 12 entries still appear in external analysis of a Python codebase (AmazonAdv/projections). The prior fix likely addressed TypeScript/JavaScript callback patterns but not Python-specific patterns (lambdas passed to `sorted()`, `filter()`, `map()`, `DataFrame.apply()`, etc.). This sub-task investigates and fixes the Python-specific gaps.

## Evidence

12 false positive entries from `callback-invocation-not-tracked` group. All are anonymous functions (`<anonymous>`):

- `<anonymous>` in `inventory/amazon_orders_and_inventory.py:50`
- `<anonymous>` in `inventory/amazon_orders_and_inventory.py:54`
- `<anonymous>` in `inventory/reconstruct_inventory_history.py:155`
- `<anonymous>` in `inventory/reconstruct_inventory_history.py:177`
- `<anonymous>` in `inventory/reconstruct_inventory_history.py:321`
- `<anonymous>` in `demand_forecasting/planner_predictions_evaluation/fetch_projections.py:380`

(Plus 6 duplicate entries from `cdk.out/` mirror of the same files)

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [ ] Investigate why task-epic-11.172 did not resolve these cases
- [ ] Identify the specific callback pattern not tracked (Python lambdas, `sorted()` key args, etc.)
- [ ] Fix callback invocation tracking to handle these patterns
- [ ] All 12 entries no longer appear as false positive entry points

## Related

- task-epic-11.172 (Done) - Prior fix for callback invocation tracking
- task-epic-11.173 (Done) - Track calls from anonymous function bodies
- task-epic-11.156 - Anonymous callback function capture
- task-163 - Parent task
