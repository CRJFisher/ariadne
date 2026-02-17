---
id: task-187
title: 'Resolve inline subclass instantiation method calls: SubClass().method()'
status: To Do
assignee: []
created_date: '2026-02-12 18:18'
labels:
  - bug
  - call-graph
dependencies:
  - task-178
priority: medium
---

## Description

2 false positives in AmazonAdv/projections where SubClass().method() calls are not resolved. The pattern is inline instantiation of a known subclass followed by an inherited method call. Reproduction: EntityAdjuster.adjust() at shared.py:168 is called via TargetAdjuster(BRAND_BUZZ).adjust() in targets.py and AdAdjuster(profile).adjust() in update_sp_performance_and_bids.py. ASINJob.run() at asin_job.py:120 is called via AddNegativeTargetsToAutoCampaigns(BRAND_BUZZ).run() in add_negative_targets_to_auto_campaigns.py. The call graph cannot infer that SubClass(...) returns an instance of SubClass (which inherits method() from ParentClass). Fix requires constructor return type inference: ClassName() returns an instance of ClassName. Root cause is likely the same extract_construct_target gap as task-178 - when ClassName() is used inline without assignment, the constructor call is never created, so the chained .method() call has no receiver type. Evidence: entrypoint-analysis/analysis_output/external/triage_entry_points/2026-02-12T18-12-14.458Z.json

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SubClass().method() resolves to ParentClass.method when method is inherited,TargetAdjuster(profile).adjust() and AddNegativeTargetsToAutoCampaigns(BRAND_BUZZ).run() resolve correctly
<!-- AC:END -->
