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

## Quality Review Addendum

Three independent reviewers (information architecture, simplicity, test coverage) identified these improvements after the constructor enrichment implementation:

### 1. Make `resolve_constructor_call` use hierarchy walking

Currently only checks `class_def.constructors?.[0]`, falling back to `class_symbol`. Should use `find_constructor_in_class_hierarchy` to handle inherited constructors directly (e.g. `new SubClass()` where SubClass has no own `__init__`).

### 2. Trim barrel exports

`index.ts` over-exports `find_constructor_in_class_hierarchy` and `find_class_definition` -- internal implementation details with zero external consumers.

### 3. Rename enrichment function

`enrich_class_calls_with_constructors` -> `include_constructors_for_class_symbols`. "Include" is precise; "enrich" is vague.

### 4. Add integration test for enrichment pipeline

No test in `call_resolver.test.ts` verifies that a function_call resolving to a class also includes the constructor in resolutions.

### 5. Add missing `function_call.test.ts` coverage

No tests for collection dispatch fallback or Python callable instance (`__call__`) fallback.
