---
id: task-188
title: Fix remaining module-qualified call resolution gaps (task-179 follow-up)
status: To Do
assignee: []
created_date: '2026-02-12 18:19'
labels:
  - bug
  - call-graph
dependencies: []
priority: medium
---

## Description

Task-179 (Done) planned a 5-step fix for Python from package import module; module.function() resolution but the implementation may be incomplete. Feb 12 re-analysis of AmazonAdv/projections still shows 3 entries failing due to module-qualified resolution: (1) finished() in utils/process_logs.py:5 called via process_logs.finished() from scrapinghub/process_results.py and rainforest/run_reviews.py, (2) get_brand_to_inventory_manager() in evaluate_projections.py:76 called via evaluate_projections.get_brand_to_inventory_manager() - triage shows total=4 unresolved=0 callers but detector still marks as entry point, meaning CallReferences resolve to wrong SymbolId. Verify that Steps 1-5 from task-179 plan are fully implemented: submodule path pre-computation in ImportGraph, widened receiver resolution gate, submodule fallback in method_lookup. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 process_logs.finished() resolves correctly across module boundaries,evaluate_projections.get_brand_to_inventory_manager() is no longer an entry point,All 5 steps from task-179 plan verified as implemented
<!-- AC:END -->
