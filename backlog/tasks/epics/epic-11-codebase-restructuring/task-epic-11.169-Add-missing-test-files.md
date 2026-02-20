# Task 11.169: Add Missing Test Files

## Status: Completed

## Parent: epic-11-codebase-restructuring

## Overview

This task tracks the implementation of test files for all source files that contain named functions but lack corresponding test coverage. The test file enforcement hook identified 28 files requiring tests.

## Files Requiring Tests

### packages/core (19 files)

#### index_single_file module
- `src/index_single_file/index_single_file.ts` - Main entry point for single file indexing

#### query_code_tree submodule
- `src/index_single_file/query_code_tree/query_code_tree.ts` - Core query tree functionality
- `src/index_single_file/query_code_tree/query_code_tree.capture_schema.ts` - Capture schema definitions
- `src/index_single_file/query_code_tree/query_code_tree.validate_captures.ts` - Capture validation

#### capture_handlers
- `src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.imports.ts` - Python import handling
- `src/index_single_file/query_code_tree/capture_handlers/capture_handlers.rust.methods.ts` - Rust method handling

#### symbol_factories (7 files)
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts`
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript_exports.ts`
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.python.ts`
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust.ts`
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust_callback.ts`
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust_imports.ts`
- `src/index_single_file/query_code_tree/symbol_factories/symbol_factories.typescript.ts`

#### Other index_single_file
- `src/index_single_file/test_utils.ts` - Test utilities (may need special handling)

#### resolve_references module
- `src/resolve_references/call_resolution/call_resolution.collection_dispatch.ts` - Collection dispatch logic
- `src/resolve_references/call_resolution/call_resolution.constructor.ts` - Constructor resolution
- `src/resolve_references/import_resolution/import_resolution.ts` - Import resolution
- `src/resolve_references/registries/registries.export.ts` - Export registry

#### trace_call_graph module
- `src/trace_call_graph/trace_call_graph.ts` - Call graph tracing

### packages/types (7 files)

Utility functions in type definition files:
- `src/common.ts` - Common utility functions
- `src/import_export.ts` - Import/export helpers
- `src/query.ts` - Query utilities
- `src/scopes.ts` - Scope utilities
- `src/symbol_definitions.ts` - Symbol definition helpers
- `src/symbol_references.ts` - Symbol reference helpers
- `src/type_id.ts` - Type ID utilities

### packages/mcp (2 files)

- `src/start_server.ts` - Server startup
- `src/tools/tools.list_functions.ts` - List functions tool

## Sub-tasks

### 11.169.1: Add tests for query_code_tree module
- `query_code_tree.test.ts`
- `query_code_tree.capture_schema.test.ts`
- `query_code_tree.validate_captures.test.ts`

### 11.169.2: Add tests for capture_handlers
- `capture_handlers.python.imports.test.ts`
- `capture_handlers.rust.methods.test.ts`

### 11.169.3: Add tests for symbol_factories
- Individual test files for each language factory

### 11.169.4: Add tests for resolve_references submodules
- `call_resolution.collection_dispatch.test.ts`
- `call_resolution.constructor.test.ts`
- `import_resolution.test.ts`
- `registries.export.test.ts`

### 11.169.5: Add tests for trace_call_graph
- `trace_call_graph.test.ts`

### 11.169.6: Add tests for packages/types utilities
- Tests for utility functions in types package

### 11.169.7: Add tests for packages/mcp
- `start_server.test.ts`
- `tools.list_functions.test.ts`

### 11.169.8: Review test_utils.ts
- Determine if test utilities need their own tests or should be excluded

## Implementation Notes

- Each test file should follow the existing test patterns in the codebase
- Use realistic code samples for testing
- Focus on testing exported functions
- Document any edge cases discovered during testing

## Success Criteria

1. All 28 files have corresponding test files
2. Tests pass in CI
3. Test coverage for exported functions is reasonable
4. No regressions in existing functionality

## Priority

Medium - Test coverage is important for code quality but not blocking feature development.

## Dependencies

- None - can be worked on independently
