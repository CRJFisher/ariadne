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

- [ ] Validation passes all accuracy thresholds (nodes-with-calls: 85%+, nodes-called-by-others: 85%+)
- [ ] CI/CD validation runs without continue-on-error
- [ ] All sub-tasks completed (remaining: 100.3, 100.6, 100.9, 100.10, and re-do 100.11.14)

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

## Sub-tasks Status

**✅ Completed:**
- task-100.2: Fix low nodes-called-by-others percentage (return type tracking)
- task-100.5: Run validation guide process ✅ (2025-08-05: Found built-in calls issue)
- task-100.7: Fix import counting accuracy (task-88) 
- task-100.8: Fix incoming call detection (task-90)
- task-100.11: Refactor project_call_graph.ts to be under 32KB (immutable architecture)
- task-100.12: Refactor Project class to be immutable with pluggable storage

**❌ Needs Re-implementation:**
- task-100.1: Fix low nodes-with-calls percentage (built-in call tracking) - Implementation missing after refactor
- task-100.11.14: Track all function calls including built-ins - Implementation lost during refactoring

**🚧 Remaining:**
- task-100.3: Complete remaining agent validation fixes (task-62 completed, final validation needed)
- task-100.6: Add file size linting to prevent validation failures
- task-100.9: Add CommonJS and ES6 export support (tasks 71-72)
- task-100.10: Complete JavaScript test updates (task-99)

Note: File size limit is resolved - index.ts reduced from 34KB to 1.4KB

## Implementation Notes

### 2025-08-05 Validation Results

Ran validation after completing the immutable refactoring (task-100.12):

**Current Metrics:**
- Nodes with calls: 34.1% (threshold: 85%) ❌
- Nodes called by others: 37.1% (threshold: 85%) ❌
- Total functions: 334
- Total edges: 210

**Key Finding:** Built-in function calls are not being tracked. This is the primary cause of low "nodes with calls" percentage. Examples include:
- console.log() calls (very common in codebase)
- Array methods (map, filter, forEach)
- JSON methods (parse, stringify)
- Object methods (keys, values)

**Root Cause:** The implementation for tracking built-in calls (task-100.11.14) appears to be missing after the refactoring. The call analysis only tracks calls to definitions found within the project.

**Next Steps:**
1. Re-implement built-in call tracking
2. Add tests for built-in call detection
3. Re-run validation to confirm improvement

The validation infrastructure is working correctly - it properly loads files, builds graphs, and tracks call relationships when they exist. The issue is purely in the call detection logic.
