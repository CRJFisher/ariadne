---
id: task-163.3
title: Fix Python instance method call resolution
status: To Do
assignee: []
created_date: '2026-01-28'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-163
---

## Description

Method calls on Python class instances (`obj.method()`) are not resolved back to the method definition in the call graph. When code creates an instance and calls a method on it (e.g., `uploader.upload_to_qb()`, `CampaignAdjuster(BRAND_BUZZ).adjust()`, `AddNegativeKeywordsToAutoCampaigns().run()`), the analyzer cannot connect the call site to the class method definition.

This is a Python-specific gap. The pattern `variable = ClassName(); variable.method()` requires tracing the type of `variable` through the assignment to resolve `method` to the class definition. Additionally, chained instantiation-and-call patterns like `ClassName().method()` need resolution.

A secondary symptom: common method names like `run()` get misattributed to unrelated module-level functions due to name-only matching without type context.

## Evidence

6 false positive entries from `instance-method-resolution` group:

- `upload_to_qb` in `amazon_ads/performance/performance_data.py:122` (2 entries)
- `adjust` in `amazon_ads/adjust/shared.py:168` (2 entries)
- `run` in `amazon_ads/maintainence/asin_job.py:120` (2 entries)

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [ ] `obj.method()` calls on Python class instances resolve to the method definition
- [ ] `ClassName().method()` chained patterns resolve correctly
- [ ] Common method names (e.g., `run`) are disambiguated by receiver type, not just name
- [ ] All 6 entries no longer appear as false positive entry points

## Related

- task-163 - Parent task
