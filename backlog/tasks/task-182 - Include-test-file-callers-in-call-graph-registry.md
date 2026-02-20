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

Functions called only from test files have their callers missing from the call graph registry. When analysis runs with test files excluded (default), test callers are not registered, making functions with only test callers appear as entry points with zero callers. Example: make_inventory_history_file_from_ads_data in fetch_inventory_data.py:89 is called only from test files. The textual grep finds the call site but the semantic call graph does not register it. Two possible fixes: (1) always register test file callers but mark them as test-only, or (2) add a deterministic classification rule in the triage pipeline for functions with only test callers.

Confirmed in Feb 12 re-analysis (1 entry: make_inventory_history_file_from_ads_data at fetch_inventory_data.py:89). Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Functions called only from test files are not flagged as false positive entry points
- [ ] #2 Test callers are either registered in call graph or classified deterministically in triage
<!-- AC:END -->
