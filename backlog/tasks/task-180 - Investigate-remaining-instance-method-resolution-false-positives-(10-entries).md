---
id: task-180
title: Investigate remaining instance-method-resolution false positives (10 entries)
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

Despite epic-11.175.3 being Completed (added semantic call type inference), the Feb 2026 re-analysis shows 10 instance-attribute-method-resolution false positives (up from 6). Root cause: instance attributes assigned in __init__ (self.rest_client = RESTClientObject()) are captured as @reference.write only, not as property definitions. walk_property_chain() in receiver_resolution.ts (line 328) fails because the property is not in the class member index. New patterns: factory function return types (client = get_client(); client.method()), constructor parameters, and self.attr = Instance() assignments. Key files: python.scm (lines 648-653 write reference vs 376-385 field definition), receiver_resolution.ts (lines 308-369), method_lookup.ts. Examples: upload_to_qb in performance_data.py:122, GET/POST/DELETE etc in rest.py, authenticate/importfromcsv/purge_records in pyqb.py. Related: task-epic-11.175.3. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-10T19-09-38.781Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root cause of remaining 10 instance-method false positives identified
- [ ] #2 Instance attributes from __init__ are tracked as class members or alternative resolution path exists
- [ ] #3 Fix implemented or follow-up task created
<!-- AC:END -->
