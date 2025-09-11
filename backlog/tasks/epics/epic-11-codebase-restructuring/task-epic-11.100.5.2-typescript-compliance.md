# Task 11.100.5.2: TypeScript Compliance for function_calls

## Parent Task

11.100.5 - Transform function_calls to Tree-sitter Queries

## Overview

Ensure zero TypeScript compilation errors and warnings for the function_calls module before and after Tree-sitter query transformation.

**Module Location**: `src/call_graph/function_calls/`

## TypeScript Compliance Requirements

### Zero TypeScript Errors Mandate

- [ ] **Strict Type Compliance**
  - Enable strict mode in tsconfig.json for this module
  - Zero `tsc` errors for all source files
  - Zero `tsc` errors for all test files
  - All function signatures properly typed

- [ ] **Type Safety Implementation**
  - FunctionCallInfo interface with proper discriminated unions
  - Call type categories with literal types
  - QueryCapture[] processing with full type safety
  - Argument metadata with correct typing

- [ ] **Interface Compliance**
  - Call types (function, async, generator) properly typed
  - Callee name extraction with string typing
  - Argument count with number typing
  - Location tracking with position types

- [ ] **Cross-Module Type Consistency**
  - Types must integrate with call_graph analysis
  - Export interfaces compatible with method_calls
  - Generic type parameters consistently defined
  - No unsafe call type assertions

### Success Criteria (TypeScript)
- **Zero `tsc` compilation errors**
- **Zero `tsc` warnings**
- **Full IntelliSense support** in VS Code
- **Proper type inference** for all call operations

## Dependencies

- Works in parallel with task 11.100.5.1 (test overhaul)
- Ensures type safety throughout the transformation process

## Notes

- Zero tolerance for TypeScript compilation errors
- Must maintain strict type safety during query-based refactoring
- Type definitions must support both current and future query-based implementation
- IntelliSense support must be maintained throughout transformation
