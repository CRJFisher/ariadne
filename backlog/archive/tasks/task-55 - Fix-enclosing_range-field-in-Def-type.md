---
id: task-55
title: Fix enclosing_range field in Def type
status: Done
assignee:
  - '@claude'
created_date: '2025-07-30'
updated_date: '2025-07-31'
labels: []
dependencies: []
---

## Description

The enclosing_range field in function definitions is currently undefined, but should contain the full range of the function body including braces. This prevents proper extraction of complete function implementations.

## Acceptance Criteria

- [x] enclosing_range field is populated for function definitions
- [x] enclosing_range includes the full function body from signature to closing brace
- [x] Core tests pass with enclosing_range assertions
- [x] MCP get_symbol_context can extract full function bodies

## Implementation Plan

1. Investigate the Def type definition and understand enclosing_range field usage
2. Find where Def objects are created in the parsers (likely in language-specific parsers)
3. Identify why enclosing_range is not being populated
4. Fix the parser logic to include full function body in enclosing_range
5. Add or update tests to verify enclosing_range contains full function bodies
6. Test with MCP get_symbol_context tool to ensure it can extract complete implementations
7. Run all core tests to ensure no regressions

## Implementation Notes

Successfully fixed the enclosing_range field population in core parsers. The issue was that enclosing_range was never being set when creating Def objects in scope_resolution.ts.

### Approach Taken

1. Added logic in build_scope_graph() to detect when a definition node is just an identifier with a function-like parent node
2. Set enclosing_range to the parent node's range for function/method/generator definitions
3. Supported all languages: JavaScript/TypeScript, Python, and Rust

### Files Modified

- `packages/core/src/scope_resolution.ts` - Added enclosing_range population logic
- `packages/core/tests/enclosing_range.test.ts` - Created comprehensive test suite
- `packages/mcp/src/tools/get_symbol_context.ts` - Removed outdated comments about the bug

### Technical Details

The tree-sitter queries only capture the identifier node for function definitions, not the full function body. By checking if the parent node is a function-like construct (function_declaration, method_definition, etc.), we can use the parent's range as the enclosing_range which includes the complete function implementation.

### Test Coverage

The test suite covers all supported languages:
- **JavaScript**: Function declarations, arrow functions, method definitions
- **TypeScript**: Typed functions with full signatures
- **Python**: Function definitions and class methods
- **Rust**: Function items and impl methods

All 278 core tests pass, and the MCP get_symbol_context tool can now extract full function bodies successfully.
