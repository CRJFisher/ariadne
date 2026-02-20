# Task 11.169.3: Add Tests for symbol_factories

## Status: Completed

## Parent: task-epic-11.169-Add-missing-test-files

## Overview

Add test files for all language-specific symbol factory modules.

## Files to Create

1. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.test.ts`
2. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript_exports.test.ts`
3. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.python.test.ts`
4. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust.test.ts`
5. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust_callback.test.ts`
6. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust_imports.test.ts`
7. `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.typescript.test.ts`

## Implementation Files

Each file contains factory functions for creating language-specific symbols from tree-sitter captures.

## Test Approach

1. Test symbol creation for each language
2. Test factory function output matches expected symbol structure
3. Use realistic code samples for each language

## Success Criteria

- All exported factory functions have test coverage
- Tests verify correct symbol ID generation
- Tests verify correct location information
