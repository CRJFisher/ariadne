# Validation Test Cases for Ariadne Accuracy Issues

This document contains specific test cases from the validation report to be used when fixing the identified issues.

## Task 87: Cross-file Call Tracking

**Issue**: Functions called from other files show 0 incoming calls

**Test Cases**:
- `extract_function_metadata`: Shows 0 incoming calls but is called from `scope_resolution.ts:346`
- `apply_max_depth_filter`: Shows 0 incoming calls but is called from `project_call_graph.ts:1324`
- `build_scope_graph`: Shows 0 incoming calls but is called from `index.ts:159`
- `is_position_within_range`: Shows 0 incoming calls but has multiple calls in `project_call_graph.ts`

## Task 88: Import Counting

**Issue**: Counts word occurrences instead of actual import statements

**Test Cases**:
- `src/graph.ts`: Reports 27 imports but only has 2 actual import statements
  ```typescript
  // Line 1: import { Tree } from 'tree-sitter';
  // Line 2: import { Point, SimpleRange, Edit, LanguageConfig } from './types';
  // Total actual imports: 2
  // Reported imports: 27
  ```
- `src/types.ts`: Reports 10 imports but only has 2 actual import statements

## Task 89: Function Over-counting

**Issue**: Function counting includes duplicates or non-function definitions

**Test Cases**:
- `src/symbol_naming.ts`: Reports 18 functions but only has ~9 exported functions
  - Actual exports: `get_symbol_id`, `getClassSymbolId`, `getMethodSymbolId`, `getFunctionSymbolId`, `getVariableSymbolId`, `getPropertySymbolId`, `getParameterSymbolId`, `getTypeSymbolId`, `getNamespaceSymbolId`

## Task 90: Incoming Call Detection

**Issue**: Missing or incorrect incoming call counts

**Test Cases**:
- `ScopeGraph.insert_ref`: Shows 0 incoming calls but is called from `scope_resolution.ts:425`
- `extract_typescript_function_metadata`: Reports 2 incoming calls but only has 1 actual call at line 20

## Task 91: Exported Function Tracking

**Issue**: Exported functions used elsewhere are marked as top-level

**Test Cases**:
- `get_symbol_id`: Exported from `index.ts:23` and called from `scope_resolution.ts:355` but marked as top-level
- `extract_class_relationships`: Exported and called from `index.ts` and `project_inheritance.ts:58` but marked as top-level

## Task 93: TypeScript Interface Counting

**Issue**: Interfaces and type definitions counted as functions

**Test Cases**:
- `src/types.ts`: Reports 21 functions but includes interfaces and type definitions
- Should only count:
  - Actual functions: `function foo() {}`
  - Methods: `class { method() {} }`
  - Arrow functions: `const foo = () => {}`
- Should NOT count:
  - Interfaces: `interface Foo {}`
  - Type aliases: `type Foo = {}`
  - Type declarations

## Validation Success Criteria

From the validation guide (Task 92):
- At least 90% of top-level nodes correctly identified (currently 25%)
- At least 85% of sampled call relationships accurate (currently 67%)
- File summaries within 20% of actual counts (currently >100% error)
- No major structural parsing errors

## Validation Files

- Script: `packages/core/agent-validation/validate-ariadne.ts`
- Output: `packages/core/agent-validation/ariadne-validation-output.yaml`
- Guide: `packages/core/agent-validation/validation-guide.md`