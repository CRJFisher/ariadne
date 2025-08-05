---
id: task-100.14
title: Add detailed validation metrics breakdown
status: To Do
assignee: []
created_date: '2025-08-05 12:02'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The current validation only shows aggregate percentages. To better debug issues, we need a breakdown showing which types of functions are missing calls or callers, file-by-file statistics, and sampling of problematic functions.

## Acceptance Criteria

- [ ] Validation output includes breakdown by file
- [ ] Shows categories of uncalled functions (exported/private/test)
- [ ] Lists top 10 functions with most calls
- [ ] Lists top 10 functions that should have calls but don't
- [ ] Provides actionable insights for improvement

## Implementation Details

### Enhanced Metrics to Add

1. **File-Level Breakdown**
   ```yaml
   file_metrics:
     - file: src/index.ts
       functions: 10
       functions_with_calls: 8
       functions_called: 3
       avg_calls_per_function: 2.5
   ```

2. **Function Categories**
   ```yaml
   uncalled_functions_breakdown:
     exported_uncalled: 45
     private_uncalled: 23
     test_functions: 12
     entry_points: 5
   ```

3. **Call Distribution**
   ```yaml
   call_distribution:
     functions_with_0_calls: 120
     functions_with_1_5_calls: 80
     functions_with_6_10_calls: 20
     functions_with_10_plus_calls: 15
   ```

4. **Problem Identification**
   ```yaml
   potential_issues:
     - type: "High-complexity uncalled function"
       function: "analyzeComplexPattern"
       file: "src/analyzer.ts"
       lines: 45
     - type: "Exported but never imported"
       function: "unusedHelper"
       file: "src/utils.ts"
   ```

### Benefits

This enhanced output will help:
1. Quickly identify which files have accuracy issues
2. Understand if uncalled functions are a design issue or detection problem
3. Find specific functions to investigate
4. Track improvement progress file-by-file
5. Prioritize which issues to fix first
