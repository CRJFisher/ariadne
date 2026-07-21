# Task 11.169.1: Add Tests for query_code_tree Module

## Status: Completed

## Parent: task-epic-11.169-Add-missing-test-files

## Overview

Add test files for the query_code_tree module's core functionality.

## Files to Create

1. `packages/core/src/index_single_file/query_code_tree/query_code_tree.test.ts`
2. `packages/core/src/index_single_file/query_code_tree/query_code_tree.capture_schema.test.ts`
3. `packages/core/src/index_single_file/query_code_tree/query_code_tree.validate_captures.test.ts`

## Implementation Files

- `query_code_tree.ts` - Core query tree building
- `query_code_tree.capture_schema.ts` - Schema definitions for captures
- `query_code_tree.validate_captures.ts` - Validation of tree-sitter captures

## Test Approach

1. Test core query tree building with sample code
2. Test schema validation for different capture types
3. Test validation error cases and edge cases

## Success Criteria

- All exported functions have test coverage
- Tests pass in CI
