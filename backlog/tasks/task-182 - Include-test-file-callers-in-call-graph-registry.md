---
id: task-182
title: Include test file callers in call graph registry
status: To Do
assignee: []
created_date: '2026-02-10 20:23'
labels:
  - bug
  - call-graph
dependencies: []
priority: low
---

## Description

Functions called only from test files have their callers missing from the call graph registry. When analysis runs with test files excluded (default), test callers are not registered, making functions with only test callers appear as entry points with zero callers. Example: get_week_number_week_of_years_today in date_util.py:88 is called only from test_date_util.py. The textual grep finds the call site but the semantic call graph does not register it. Two possible fixes: (1) always register test file callers but mark them as test-only, or (2) add a deterministic classification rule in the triage pipeline for functions with only test callers. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Functions called only from test files are not flagged as false positive entry points
- [ ] #2 Test callers are either registered in call graph or classified deterministically in triage
<!-- AC:END -->
