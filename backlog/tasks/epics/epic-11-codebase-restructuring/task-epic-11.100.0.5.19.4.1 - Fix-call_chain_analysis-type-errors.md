---
id: task-epic-11.100.0.5.19.4.1
title: Fix call_chain_analysis module type errors after file_analyzer update
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['downstream-consumer', 'type-system', 'compilation-errors']
dependencies: ['task-epic-11.100.0.5.19.4']
parent_task_id: task-epic-11.100.0.5.19.4
priority: high
---

## Description

Fix compilation errors in call_chain_analysis module that emerged after updating file_analyzer to use new types directly.

## Compilation Errors Identified

1. **Missing receiver_type property** in MethodCall objects
2. **CallChainNode property mismatches** - using 'caller' instead of 'call'
3. **String to SymbolId conversion issues** in function calls
4. **Missing CallChain properties** - max_depth, is_recursive
5. **Property name mismatches** in FunctionCall, MethodCall, ConstructorCall

## Changes Required

### 1. Update CallChainNode Structure
- Replace 'caller' with 'call' property
- Ensure proper CallChainNode interface compliance

### 2. Fix Call Object Properties
- Update FunctionCall to use new property names (caller vs caller_name, callee vs callee_name)
- Update MethodCall to include receiver_type property
- Update ConstructorCall property references

### 3. Fix SymbolId Usage
- Convert string parameters to SymbolId using appropriate factory functions
- Update Map types from Map<string, Set<string>> to Map<SymbolId, Set<SymbolId>>

### 4. Update CallChain Interface
- Add missing properties: max_depth, is_recursive
- Fix property references throughout the module

## Acceptance Criteria

- [ ] All compilation errors in call_chain_analysis module resolved
- [ ] CallChainNode uses correct property names
- [ ] All SymbolId conversions implemented properly
- [ ] CallChain interface includes all required properties
- [ ] Tests compile and pass