---
id: task-179
title: Update module-qualified-call-resolution with root cause analysis
status: To Do
assignee: []
created_date: '2026-02-10 20:22'
labels:
  - bug
  - call-graph
dependencies: []
priority: medium
---

## Description

The Feb 2026 re-analysis of AmazonAdv/projections shows 17 module-qualified-call-resolution false positives (up from 5). Root cause identified: when from package import module makes a named import, resolve_identifier_base() in receiver_resolution.ts only checks for namespace imports. Fix: detect that a named import resolves to a module (not a function/class) and treat it like a namespace import for method resolution. Key files: imports.python.ts (lines 96-118), receiver_resolution.ts (lines 235-262), method_lookup.ts (lines 42-77, 253-277). Examples: train in pipeline.py:55, qb_to_rows in read.py:387, generate_predictions_at_date in generate.py:26. Related: task-epic-11.175.8. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Named imports that resolve to modules are treated as namespace imports in receiver resolution
- [ ] #2 Module.function() calls resolve to function definitions
- [ ] #3 Tests cover from package import module and import module patterns
<!-- AC:END -->
