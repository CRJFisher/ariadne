---
id: task-100.6
title: Add file size linting to prevent validation failures
status: Done
assignee:
  - "@claude"
created_date: "2025-08-04 12:03"
updated_date: "2025-08-05 11:01"
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Create a proactive file size check to ensure source files stay under the 32KB tree-sitter limit. This prevents validation failures and maintains codebase analyzability.

The script should:

- Check all TypeScript/JavaScript files
- Warn at 28KB (approaching limit)
- Error at 32KB (exceeds limit)
- Run in CI and validate-ariadne
- Automatically run before any commit
  - Is there a a way to do this with git hooks?
  - Or, is there a way to do this deterministically with claude code?
- Suggest refactoring for large files

Currently only project_call_graph.ts (60KB) exceeds the limit.

## Acceptance Criteria

- [x] File size check implemented
- [x] Integrated into CI workflow
- [x] Added to validate-ariadne script
- [x] Clear warning/error thresholds
- [x] Refactoring guidance provided

## Implementation Plan

1. Create a file size check script that scans all source files
2. Add warning threshold at 28KB and error threshold at 32KB
3. Integrate into existing validation workflow
4. Add pre-commit hook for automatic checking. This should block the commit if a TS/JS file is too large.
5. Create npm script for manual checks
6. Add to CI/CD pipeline
7. Document usage and refactoring guidance

## Implementation Notes

Implemented comprehensive file size linting:

1. Created scripts/check-file-sizes.ts with 28KB warning and 32KB error thresholds
2. Added npm scripts: check:size and check:size:warn
3. Integrated into CI/CD pipeline (test.yml workflow)
4. Created git pre-commit hook that runs automatically
5. Validation script already had file size checking
6. Created documentation in docs/file-size-linting.md

Currently 3 files exceed the limit:

- agent-validation/src/project_call_graph.js (62.7KB)
- tests/call_graph.test.ts (54.7KB)
- tests/languages/javascript.test.ts (40.9KB)

These will need refactoring in a separate task.
