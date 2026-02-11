---
id: task-178
title: Investigate remaining constructor resolution false positives (40 entries)
status: To Do
assignee: []
created_date: '2026-02-10 20:22'
updated_date: '2026-02-10 20:22'
labels:
  - bug
  - call-graph
dependencies: []
priority: medium
---

## Description

Despite epic-11.175.1 being Completed (renamed constructor field to constructors), the Feb 2026 re-analysis of AmazonAdv/projections shows 40 constructor-resolution-bug false positives (up from 26). The remaining entries include both Python __init__ methods and JS constructor methods. Investigate why the prior fix did not fully resolve these cases. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json. Related: task-epic-11.175.1

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root cause of remaining 40 constructor false positives identified
- [ ] #2 Fix implemented or follow-up task created
<!-- AC:END -->
