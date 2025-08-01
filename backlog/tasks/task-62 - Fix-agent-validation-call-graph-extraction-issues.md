---
id: task-62
title: Fix agent validation call graph extraction issues
status: In Progress
assignee:
  - '@chuck'
created_date: '2025-08-01'
updated_date: '2025-08-01'
labels:
  - bug
  - validation
  - call-graph
dependencies:
  - task-61
---

## Description

The agent validation framework reveals that Ariadne's call graph extraction is not working correctly when analyzing its own codebase. No function calls are being detected, metadata is missing, and top-level node identification is incorrect.

## Acceptance Criteria

- [x] Call relationships are correctly extracted and shown in output
- [x] Line numbers and source snippets are populated
- [ ] Top-level nodes correctly exclude functions called within the same module
- [x] File summary shows individual file statistics
- [ ] Agent validation report shows >100% accuracy

## Implementation Plan

1. Fix the agent validation script to use correct CallGraph API
2. Update property access to use node.definition instead of direct properties
3. Fix edge filtering to use 'from'/'to' instead of 'source'/'target'
4. Update source extraction to handle the returned object structure
5. Fix file summary to iterate through nodes correctly

## Implementation Notes

Fixed the agent validation script to correctly use the CallGraph API:

**Issues fixed:**

- Wrong property names: Changed `e.source`/`e.target` to `e.from`/`e.to` for edges
- Wrong node access: Changed direct property access to `node.definition.*`
- Wrong method usage: `get_source_with_context` returns an object with `source` property
- File summary aggregation: Now correctly iterates through nodes and tracks per-file stats

**Results:**

- Call relationships now detected: 43 calls found (was 0)
- Line numbers populated: All nodes show correct line numbers
- Source snippets extracted: All sampled nodes include source code
- File summaries fixed: Shows individual file statistics with function counts

**Remaining issues:**

- Export detection not working: All `is_exported` values show false
- Some intra-module calls missing: Leading to incorrect top-level identification
- Main index.ts still skipped due to 32KB limit

**Accuracy improvement:** From ~20% to ~75% - most core functionality now works correctly.
