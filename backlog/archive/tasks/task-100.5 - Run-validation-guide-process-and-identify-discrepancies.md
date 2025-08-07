---
id: task-100.5
title: Run validation guide process and identify discrepancies
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-04 11:55'
updated_date: '2025-08-04 13:40'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Follow the validation-guide.md process to manually verify Ariadne's accuracy and identify specific discrepancies between expected and actual results

## Acceptance Criteria

- [x] Validation process completed
- [x] Discrepancies documented
- [x] New test cases created for each discrepancy

## Implementation Plan

1. Read the validation-guide.md to understand the process
2. Run the self-analysis validation script on Ariadne itself
3. Compare the output against expected metrics (85% thresholds)
4. Analyze specific failures and identify patterns
5. Document each discrepancy with examples
6. Create test cases for identified issues

## Implementation Notes

Ran the Ariadne self-analysis validation process and identified critical discrepancies:

1. File Size Limit Issue:
   - project_call_graph.ts (60.1KB) was skipped due to 32KB tree-sitter limit
   - This file contains many function calls, causing false top-level node identification
   - Without this file, the analysis is fundamentally incomplete

2. Method Call Detection Failure:
   - Method calls on built-in types (Array, Map, Set, String, etc.) are not tracked
   - Functions like apply_max_depth_filter and generateLargeFile show 0 outgoing calls despite having many
   - This causes the 'nodes with calls' metric to be only 36.9% instead of 85%

3. Created Test Cases:
   - method-call-detection.test.ts: Tests for tracking method calls on built-in types
   - large-file-handling.test.ts: Tests for handling files over 32KB limit

4. Deliverables:
   - validation-report-2025-08-04.md: Detailed validation report with examples
   - Two new test files capturing the identified issues

These findings explain why validation metrics are below thresholds and provide clear targets for fixes.
