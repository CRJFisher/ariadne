---
id: task-epic-11.100.0.5.19.9.8
title: Update call chain analysis for new call types
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['refactoring', 'call-graph', 'call-chains']
dependencies: ['task-epic-11.100.0.5.19.9']
parent_task_id: task-epic-11.100.0.5.19.9
priority: medium
---

## Description

Update call chain analysis module to work with the new CallInfo union type and resolve compilation errors related to type changes.

## Current Issues

From TypeScript compilation, call_chain_analysis has multiple errors related to:
1. Accessing properties that don't exist on the new types
2. Type mismatches with SymbolId vs string types
3. Missing properties on CallChain and CallChainNode types

## Affected Files

- `call_chain_analysis/call_chain_analysis.ts` - Main logic
- `call_chain_analysis/call_chain_analysis.test.ts` - Tests
- `call_chain_analysis/index.ts` - Exports

## Required Changes

### 1. Update Call Info Handling

The module currently accesses properties like:
- `caller_name` on FunctionCall (should be `caller_context`)
- `callee_name` on FunctionCall (should be `callee`)
- `method_name` on MethodCall (should be `method`)

Need to:
- Use proper property names from new types
- Implement type guards to narrow CallInfo to specific call types
- Update property access patterns

### 2. Fix SymbolId Usage

Several places use string where SymbolId is expected:
- Convert strings to SymbolId using appropriate factory functions
- Update Map types to use SymbolId consistently
- Ensure proper type conversion at boundaries

### 3. Update CallChain and CallChainNode Types

Fix missing properties on types:
- Add missing `max_depth` property to CallChain
- Add missing `is_recursive` and `cycle_point` properties
- Fix `caller`/`callee` vs `call` property naming inconsistencies

### 4. Update Test Assertions

Update test files to:
- Use correct property names
- Handle the new type structures
- Use proper type assertions

## Acceptance Criteria

- [ ] All TypeScript compilation errors resolved
- [ ] Call chain analysis works with CallInfo union type
- [ ] Tests pass with updated type structures
- [ ] No functionality lost in the conversion
- [ ] Proper SymbolId usage throughout
- [ ] Type safety maintained