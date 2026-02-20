---
id: task-183
title: 'Feb 2026 re-analysis: Update epic-11.175 tracking'
status: Done
assignee: []
created_date: '2026-02-10 20:23'
updated_date: '2026-02-10 20:23'
labels:
  - epic-11
  - tracking
dependencies: []
---

## Description

Re-ran external analysis on AmazonAdv/projections (Feb 10, 2026). Results: 1,226 files analyzed, 1,847 entry points detected, 255 true positives, 8 false positive groups. Updated counts vs Jan 28 original: constructor-resolution-bug 40 (was 26), module-qualified-call-resolution 17 (was 5), dynamic-dispatch-getattr 14 (new, fundamental limitation), instance-attribute-method-resolution 10 (was 6), react-lifecycle-callback 1 (new), test-file-caller-not-in-registry 1 (new), cdk-build-artifact-duplicate 1 (new, environmental), unused-library-method 1 (new, true positive misclassified). Detection output: external/detect_entrypoints/2026-02-10T18-18-58.950Z.json. Triage output: external/triage_entry_points/2026-02-10T19-09-38.781Z.json. Follow-up tasks: task-178 (constructor), task-179 (module-qualified), task-180 (instance-method), task-181 (react lifecycle), task-182 (test callers).

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All follow-up tasks created and linked
<!-- AC:END -->

## Implementation Notes

All follow-up tasks created: task-178, task-179, task-180, task-181, task-182.
