---
id: task-epic-11.100.0.5.19.12.1
title: Fix call graph type migrations
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['type-migration', 'compilation-error', 'call-graph']
dependencies: ['task-epic-11.100.0.5.19.12']
parent_task_id: task-epic-11.100.0.5.19.12
priority: high
---

## Description

Fix compilation errors in call graph modules due to incomplete type migration from the broader type system refactoring.

## Compilation Errors to Fix

### call_chain_analysis module
- Missing `resolved` property in FunctionCall/ConstructorCall types
- Missing `resolution_path` property in Resolution objects
- Property name mismatches: `caller`/`callee` vs `call` in CallChainNode
- Missing `max_depth`, `is_recursive`, `cycle_point` properties in CallChain
- Type mismatches between SymbolId and string

### constructor_calls modules (all languages)
- Missing `constructor_name` property in ConstructorCall
- Missing language-specific properties:
  - JavaScript: `is_factory_method`
  - Python: `is_super_call`, `is_factory_method`
  - Rust: `is_enum_variant`, `is_tuple_struct`
- Type mismatches in SymbolId assignments

## Files Requiring Updates

### Primary Files
- `src/call_graph/call_chain_analysis/call_chain_analysis.ts`
- `src/call_graph/call_chain_analysis/call_chain_analysis.test.ts`
- `src/call_graph/constructor_calls/constructor_calls.javascript.ts`
- `src/call_graph/constructor_calls/constructor_calls.python.ts`
- `src/call_graph/constructor_calls/constructor_calls.rust.ts`

### Test Files
- `src/call_graph/constructor_calls/constructor_calls.*.test.ts` (all languages)

## Root Cause

The type definitions in `@ariadnejs/types` have been updated but the implementation code hasn't been migrated to match the new type signatures.

## Acceptance Criteria

- [ ] All call_graph modules compile without TypeScript errors
- [ ] All test files compile without TypeScript errors
- [ ] Type usage is consistent with new type definitions
- [ ] No regression in existing functionality
- [ ] All existing tests pass after type fixes

## Priority

**HIGH** - Blocking compilation and development progress