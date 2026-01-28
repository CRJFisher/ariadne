---
id: task-epic-11.175.4
title: Fix Python module-qualified call resolution
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

Function calls made through Python module-qualified names (`module.function()`) or module-aliased imports (`import x as y; y.function()`) are not resolved in the call graph. The analyzer does not trace Python import statements to connect attribute access on module objects to function definitions.

This is a Python-specific pattern. In Python, `import module` followed by `module.function()` is the standard calling convention. The call graph needs to resolve the module reference through the import to find the target function definition.

## Evidence

5 false positive entries from `module-qualified-call-resolution` group:

- `is_performance_good` in `amazon_ads/create_campaigns/similar_item_keywords.py:282`
- `generate_predictions_at_date` in `demand_forecasting/predict/generate.py:26`
- `save_photos_in_brandfolder_dropbox_and_s3` in `product_photos/runtime/final_io.py:44`
- `qb_to_csv_text` in `quickbase/read.py:442`
- `get_order_history_df` in `demand_forecasting/planner_predictions_evaluation/planner_predictions_evaluation.py:152`

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [ ] `import module; module.function()` calls resolve to the function definition
- [ ] `import module as alias; alias.function()` calls resolve correctly
- [ ] `from package import module; module.function()` calls resolve correctly
- [ ] All 5 entries no longer appear as false positive entry points

## Related

- task-163 - Parent task
