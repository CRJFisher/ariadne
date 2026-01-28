---
id: task-epic-11.175.1
title: Resolve remaining constructor resolution gaps
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

Python `__init__` methods and JavaScript `constructor` methods appear as false positive entry points because class instantiation calls (`ClassName()` in Python, `new ClassName()` in JS) are not resolved to the constructor definition in the call graph.

task-epic-11.171 previously fixed constructor resolution lookup for TypeScript and is marked Done. However, 26 entries still appear in external analysis of a Python codebase (AmazonAdv/projections). The prior fix likely addressed TypeScript-specific patterns (`new ClassName()`) but not Python's constructor invocation pattern (`ClassName()` which implicitly calls `__init__`). This sub-task investigates and fixes the Python-specific gaps.

## Evidence

26 false positive entries from `constructor-resolution-bug` group. Examples:

- `__init__` in `amazon_ads/adjust/shared.py:46`
- `__init__` in `amazon_ads/api_actions/shared.py:173`
- `__init__` in `amazon_ads/maintainence/asin_job.py:34`
- `constructor` in `qb_code_pages/batch_add_products_to_inventory_request/src/App.js:65`
- `__init__` in `demand_forecasting/timesfm/timesfm_base.py:238`

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [ ] Investigate why task-epic-11.171 did not resolve these cases
- [ ] Identify the specific resolution gap (cross-module instantiation, aliased imports, etc.)
- [ ] Fix the constructor call resolution to handle these patterns
- [ ] All 26 entries no longer appear as false positive entry points

## Related

- task-epic-11.171 (Done) - Prior fix for constructor resolution lookup
- task-163 - Parent task
