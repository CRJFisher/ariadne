---
id: task-epic-11.100.0.5.19.20.1
title: Fix call_chain_analysis test type mismatches
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['testing', 'type-migration', 'call-analysis']
dependencies: ['task-epic-11.100.0.5.19.20']
parent_task_id: task-epic-11.100.0.5.19.20
priority: high
---

## Description

Fix compilation errors in call_chain_analysis tests caused by missing required properties in CallInfo test objects.

## Issues Found

### Missing 'resolved' Properties
Multiple test objects are missing the required `resolved` property:

```
src/call_graph/call_chain_analysis/call_chain_analysis.test.ts(21,9): error TS2741: Property 'resolved' is missing in type '{ kind: "function"; caller: CallerName; callee: SymbolId; ... }' but required in type 'FunctionCall'.
```

### Missing 'resolution_path' Properties
Resolution objects are missing required `resolution_path` field:

```
src/call_graph/call_chain_analysis/call_chain_analysis.test.ts(113,11): error TS2741: Property 'resolution_path' is missing in type '{ resolved: { type_name: ClassName; type_kind: ResolvedTypeKind; }; ... }' but required in type 'Resolution<...>'.
```

## Changes Required

### 1. Add Missing Required Properties

Update test objects to include all required properties:

```typescript
// Add to FunctionCall test objects
resolved: resolve_failed("not_found", "Test function not resolved"),

// Add to MethodCall test objects
receiver_type: resolve_failed("not_found", "Test receiver not resolved"),
resolved: resolve_failed("not_found", "Test method not resolved"),

// Add to ConstructorCall test objects
resolved: resolve_failed("not_found", "Test constructor not resolved"),
```

### 2. Fix Resolution Objects

Add missing `resolution_path` to Resolution objects:

```typescript
// Update resolution objects
{
  resolved: { type_name: "MyClass" as ClassName, type_kind: "class" as ResolvedTypeKind },
  confidence: "low" as const,
  reason: "not_found" as const,
  resolution_path: [] // Add this required field
}
```

## Files to Update

- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.test.ts`

## Acceptance Criteria

- [ ] All FunctionCall test objects have required 'resolved' property
- [ ] All MethodCall test objects have required 'receiver_type' and 'resolved' properties
- [ ] All ConstructorCall test objects have required 'resolved' property
- [ ] All Resolution objects have required 'resolution_path' property
- [ ] Tests compile without type errors
- [ ] Tests still pass after fixes