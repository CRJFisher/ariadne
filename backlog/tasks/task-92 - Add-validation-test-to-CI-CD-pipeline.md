---
id: task-92
title: Add validation test to CI/CD pipeline
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies:
  - task-87
  - task-88
  - task-89
  - task-90
  - task-91
---

## Description

Once the accuracy issues are fixed, the validation test should be added to the CI/CD pipeline to ensure Ariadne can accurately analyze its own codebase. This will prevent regressions in call graph accuracy.

## Acceptance Criteria

- [ ] Validation test runs in CI/CD
- [ ] Test fails if accuracy drops below thresholds
- [ ] Automated validation of self-analysis accuracy

## Implementation Notes

Success criteria from validation guide:

- At least 90% of top-level nodes correctly identified (currently 25%)
- At least 85% of sampled call relationships accurate (currently 67%)
- File summaries within 20% of actual counts (currently >100% error)
- No major structural parsing errors

The validation script is located at: packages/core/agent-validation/validate-ariadne.ts
Output is saved to: packages/core/agent-validation/ariadne-validation-output.yaml
