---
id: task-epic-11.100.0.5.19.4.2
title: Fix constructor_calls module type errors after file_analyzer update
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['downstream-consumer', 'type-system', 'compilation-errors']
dependencies: ['task-epic-11.100.0.5.19.4']
parent_task_id: task-epic-11.100.0.5.19.4
priority: high
---

## Description

Fix compilation errors in constructor_calls module that emerged after updating file_analyzer to use new types directly.

## Compilation Errors Identified

1. **String to SymbolId conversion issues** in multiple language files
2. **Missing ConstructorCall properties** - kind, class_name, is_factory, caller, etc.
3. **Property name mismatches** - using constructor_name instead of expected properties
4. **Type conversion errors** in language-specific implementations

## Affected Files

- `src/call_graph/constructor_calls/constructor_calls.javascript.ts`
- `src/call_graph/constructor_calls/constructor_calls.python.ts`
- `src/call_graph/constructor_calls/constructor_calls.rust.ts`
- `src/call_graph/constructor_calls/constructor_calls.typescript.ts`
- `src/call_graph/constructor_calls/constructor_type_extraction.ts`
- `src/call_graph/constructor_calls/constructor_type_resolver.ts`

## Changes Required

### 1. Update ConstructorCall Object Structure
- Add missing required properties: kind, class_name, is_factory, caller, etc.
- Remove deprecated properties like constructor_name
- Ensure proper ConstructorCall interface compliance

### 2. Fix SymbolId Conversions
- Convert string constructor names to SymbolId using constructor_symbol()
- Update type annotations throughout

### 3. Update Property References
- Replace constructor_name with proper SymbolId properties
- Fix property access patterns in type resolver

### 4. Fix Type Extraction Issues
- Update Map iteration to handle SymbolId keys properly
- Fix downlevelIteration issues with Map<string, TypeInfo[]>

## Acceptance Criteria

- [ ] All compilation errors in constructor_calls module resolved
- [ ] ConstructorCall objects include all required properties
- [ ] All string to SymbolId conversions implemented
- [ ] Property references updated throughout module
- [ ] Tests compile and pass