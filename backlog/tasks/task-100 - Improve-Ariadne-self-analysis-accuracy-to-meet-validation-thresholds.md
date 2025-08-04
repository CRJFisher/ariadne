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

Epic task to drive real-world effectiveness through an iterative validation and fix process. The goal is to repeatedly run the validation process until Ariadne can accurately parse and process its own codebase, meeting all accuracy thresholds.

Current validation results show:
- Nodes with calls: 36.9% (threshold: 85%)
- Nodes called by others: 65.0% (threshold: 85%)

**Iterative Process:**
1. Run the validation guide (packages/core/agent-validation/validation-guide.md)
2. Identify specific discrepancies and failures
3. Create test cases that capture each fault
4. Create sub-tasks for each issue found
5. Fix the issues by debugging and implementing solutions
6. Once all sub-tasks are complete, re-run the validation guide
7. Repeat steps 1-6 until all thresholds are met

This iterative approach ensures we address all issues systematically and verify fixes work correctly.

## Acceptance Criteria

- [ ] Validation passes all accuracy thresholds
- [ ] CI/CD validation runs without continue-on-error
- [ ] All sub-tasks completed

## Implementation Plan

**Iteration 1 (Current):**
1. ✅ Run validation guide process (task-100.5) - identified method call and file size issues
2. Create test cases for identified issues (method-call-detection.test.ts, large-file-handling.test.ts)
3. Fix identified issues through sub-tasks:
   - task-100.11: Refactor project_call_graph.ts (60KB → under 32KB) - critical for analysis
   - task-100.8: Fix incoming call detection (method calls)
   - task-100.1: Fix low nodes-with-calls percentage
   - task-100.2: Fix low nodes-called-by-others percentage
   - Other sub-tasks as needed

**Iteration 2+ (After fixes):**
1. Re-run validation guide to check improvements
2. Identify any remaining discrepancies
3. Create new test cases and sub-tasks if needed
4. Fix new issues found
5. Repeat until all thresholds are met

**Final Steps:**
- Remove continue-on-error from CI/CD validation
- Document the fixes and improvements made

Sub-tasks:
- task-100.1: Fix low nodes-with-calls percentage
- task-100.2: Fix low nodes-called-by-others percentage  
- task-100.3: Complete remaining agent validation fixes
- task-100.5: Run validation guide process ✅
- task-100.6: Add file size linting to prevent validation failures
- task-100.7: Fix import counting accuracy (task-88)
- task-100.8: Fix incoming call detection (task-90)
- task-100.9: Add CommonJS and ES6 export support (tasks 71-72)
- task-100.10: Complete JavaScript test updates (task-99)
- task-100.11: Refactor project_call_graph.ts to be under 32KB

Note: File size limit is tracked in task-60 (affects project_call_graph.ts)
