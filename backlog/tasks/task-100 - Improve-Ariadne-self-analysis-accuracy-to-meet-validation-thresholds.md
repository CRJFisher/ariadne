---
id: task-100
title: Improve Ariadne self-analysis accuracy to meet validation thresholds
status: To Do
assignee: []
created_date: '2025-08-04 11:53'
updated_date: '2025-08-04 11:55'
labels:
  - epic
  - validation
  - accuracy
dependencies: []
---

## Description

Epic task to drive real-world effectiveness by fixing validation discrepancies. The goal is to run the validation process in packages/core/agent-validation/validation-guide.md and fix all issues until accuracy thresholds are met.

Current validation results show:
- Nodes with calls: 36.9% (threshold: 85%)
- Nodes called by others: 65.0% (threshold: 85%)

This involves identifying discrepancies, adding test cases, creating fix tasks, and implementing solutions.

## Acceptance Criteria

- [ ] Validation passes all accuracy thresholds
- [ ] CI/CD validation runs without continue-on-error
- [ ] All sub-tasks completed

## Implementation Plan

1. Run the validation process to establish baseline metrics
2. Analyze validation output to identify specific issues:
   - Low nodes-with-calls percentage (36.9% vs 85%)
   - Low nodes-called-by-others percentage (65% vs 85%)
3. Create test cases that capture each identified fault
4. Implement fixes for each issue
5. Re-run validation to verify improvements
6. Remove continue-on-error from CI/CD once thresholds are met

Sub-tasks:
- task-100.1: Fix low nodes-with-calls percentage
- task-100.2: Fix low nodes-called-by-others percentage  
- task-100.3: Complete remaining agent validation fixes
- task-100.5: Run validation guide process
- task-100.6: Add file size linting to prevent validation failures
- task-100.7: Fix import counting accuracy (task-88)
- task-100.8: Fix incoming call detection (task-90)
- task-100.9: Add CommonJS and ES6 export support (tasks 71-72)
- task-100.10: Complete JavaScript test updates (task-99)

Note: File size limit is tracked in task-60 (only affects project_call_graph.ts)
