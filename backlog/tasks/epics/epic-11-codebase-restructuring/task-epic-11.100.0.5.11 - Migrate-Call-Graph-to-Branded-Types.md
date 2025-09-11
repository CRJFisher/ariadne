---
id: task-epic-11.100.0.5.11
title: Migrate Call Graph to Branded Types
status: Complete
assignee: []
created_date: '2025-09-11 18:33'
labels: []
dependencies: []
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Replace all raw strings in call graph types with appropriate branded types

## Implementation Notes

### Completed: 2025-09-11

Call graph types were already migrated to branded types during task 11.100.0.5.2:

1. **unified-call-types.ts uses**:
   - `CallerContext` instead of raw string for caller names
   - `CalleeName` for function/method names being called
   - `ReceiverName` for object receiving method calls
   - `SymbolId` for unique symbol identifiers
   - `SymbolName` for symbol names
   - `ClassName` for class names in constructor calls

2. **Migration already complete**:
   - All call types (FunctionCall, MethodCall, ConstructorCall) use branded types
   - Resolution types use SymbolId and ModulePath
   - No raw strings remain in call graph types

3. **Deprecated old types**:
   - Added deprecation notice to FunctionCallInfo, MethodCallInfo, ConstructorCallInfo
   - These are kept for backward compatibility but should be removed
   - New code should use UnifiedCallInfo discriminated union
