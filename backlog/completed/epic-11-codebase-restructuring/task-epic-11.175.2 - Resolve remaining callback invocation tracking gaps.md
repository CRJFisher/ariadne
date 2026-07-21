---
id: task-epic-11.175.2
title: Resolve remaining callback invocation tracking gaps
status: Done
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

- [x] Investigate why task-epic-11.172 did not resolve these cases
- [x] Identify the specific callback pattern not tracked (Python lambdas, `sorted()` key args, etc.)
- [x] Fix callback invocation tracking to handle these patterns
- [x] All 12 entries no longer appear as false positive entry points

## Related

- task-epic-11.172 (Done) - Prior fix for callback invocation tracking
- task-epic-11.173 (Done) - Track calls from anonymous function bodies
- task-epic-11.156 - Anonymous callback function capture
- task-163 - Parent task

## Implementation Notes (Jan 29, 2026)

### Root Cause Analysis

The triage output showing 12 false positives was **stale** - generated with dist/ that didn't include the fix from task-epic-11.172:

- **Jan 20, 15:27**: Fix committed (6f2950d1 - "Track callback invocations for internal functions")
- **Jan 28, 10:37**: Triage run with stale dist/ (72 minutes before build hook added)
- **Jan 28, 11:49**: Build hook added (255a06c3) to prevent stale dist/ issues

### Verified Fix for Python

Tested all three false positive patterns with current dist/:

1. **Dictionary unpacking** (`df.assign(**{key: lambda...})`): Not entry point
2. **DataFrame apply** (`df.groupby().apply(lambda...)`): Not entry point
3. **defaultdict factory** (`defaultdict(lambda: ...)`): Not entry point

### Additional Fix: Keyword Argument Lambda Capture

Added tree-sitter query to capture lambdas in keyword arguments:

```scm
; Lambda in keyword arguments (sorted key=, pandas axis=, etc.)
(keyword_argument
  value: (lambda) @definition.anonymous_function
)
```

This handles patterns like `sorted(items, key=lambda x: x.value)`.

### Test Coverage Added

**Unit tests** (symbol_factories.python.test.ts):
- 15 new tests for `detect_callback_context` covering all callback patterns
- Tests for map, filter, sorted, reduce, df.apply, dictionary unpacking, defaultdict
- Negative tests for standalone lambda, list literal, dict literal

### Files Changed

- `packages/core/src/index_single_file/query_code_tree/queries/python.scm` - Added keyword argument lambda capture query
- `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.python.test.ts` - Added detect_callback_context tests

### Completion Date

2026-01-29
