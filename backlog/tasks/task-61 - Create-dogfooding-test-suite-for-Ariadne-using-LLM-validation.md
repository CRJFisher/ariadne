---
id: task-61
title: Create dogfooding test suite for Ariadne using LLM validation
status: Done
assignee:
  - '@chuck'
created_date: '2025-08-01'
updated_date: '2025-08-01'
labels:
  - testing
  - integration
  - validation
dependencies:
  - task-24
---

## Description

Implement a self-testing framework where Ariadne parses its own codebase, outputs results in LLM-readable format (YAML), and provides instructions for agent-based validation of the call graph accuracy.

## Acceptance Criteria

- [x] Script outputs top-level nodes to YAML format
- [x] Script includes sampling mechanism for selected nodes
- [x] Validation instructions document created for LLM agents
- [x] Basic test runs successfully on Ariadne codebase
- [x] Output format is optimized for LLM readability

## Implementation Plan

1. Create a TypeScript script that uses Ariadne to parse its own codebase
2. Implement YAML output formatter for call graph data
3. Add sampling logic to select representative nodes for validation
4. Write LLM-friendly validation instructions
5. Test the script on the Ariadne repository

## Implementation Notes

Created a comprehensive dogfooding test suite for Ariadne that includes:

**Features implemented:**
- TypeScript test script at `packages/core/tests/dogfood_test.ts` that parses Ariadne's own codebase
- YAML output format with structured data including metadata, top-level nodes, sampled nodes, and file summaries
- Automatic handling of tree-sitter's 32KB file size limitation by skipping large files
- Sampling mechanism that selects both top-level and non-top-level nodes for validation
- Error handling and progress logging during analysis

**Files created/modified:**
- `/packages/core/tests/dogfood_test.ts` - Main test script
- `/docs/dogfood-validation-guide.md` - Comprehensive validation instructions for LLM agents
- `/packages/core/package.json` - Added js-yaml dependencies

**Technical decisions:**
- Used YAML format for output as it's highly readable for both humans and LLMs
- Implemented graceful handling of missing range information (line numbers)
- Added file size checking to avoid tree-sitter parsing errors on large files (>32KB)
- Structured output to include both overview data and detailed samples for validation

**Known limitations:**
- The current implementation skips `index.ts` (44KB) due to tree-sitter size limits
- Line number information is not always available (shows as 0) 
- File summary aggregation needs improvement to show individual file stats

The test successfully runs on the Ariadne codebase, producing a YAML output file that can be validated by LLM agents following the provided guide.

Successfully implemented dogfooding test suite with YAML output and LLM validation guide. Test runs on Ariadne codebase with some limitations due to tree-sitter file size constraints.
