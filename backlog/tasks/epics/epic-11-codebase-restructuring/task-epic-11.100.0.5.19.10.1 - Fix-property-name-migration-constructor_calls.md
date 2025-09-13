---
id: task-epic-11.100.0.5.19.10.1
title: Fix property name migration in constructor_calls module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['bug-fix', 'type-migration']
dependencies: ['task-epic-11.100.0.5.19.10']
parent_task_id: task-epic-11.100.0.5.19.10
priority: high
---

## Description

Fix property name mismatches in constructor_calls module after migrating to new CallInfo type.

## Issues Found

The new `ConstructorCall` interface uses different property names than the legacy `ConstructorCallInfo`:

1. **constructor_name** → **class_name**
2. **is_factory_method** → **is_factory**

## Files Affected

Based on grep analysis, these files contain old property names:

- `constructor_calls.javascript.test.ts` - Line 50: `constructor_name`
- `constructor_calls.test.ts` - Multiple references
- `constructor_calls.rust.test.ts` - Multiple references
- `constructor_calls.typescript.test.ts` - Multiple references
- `constructor_calls.python.test.ts` - Multiple references
- All implementation files (.ts) with legacy property names

## Required Changes

### 1. Replace constructor_name with class_name

```typescript
// OLD
result.constructor_name = "MyClass";
expect(result?.constructor_name).toBe("Person");

// NEW
result.class_name = "MyClass" as ClassName;
expect(result?.class_name).toBe("Person");
```

### 2. Replace is_factory_method with is_factory

```typescript
// OLD
is_factory_method: true

// NEW
is_factory: true
```

## Acceptance Criteria

- [ ] All references to `constructor_name` replaced with `class_name`
- [ ] All references to `is_factory_method` replaced with `is_factory`
- [ ] All constructor_calls tests passing
- [ ] TypeScript compilation errors resolved
- [ ] Property types match new ConstructorCall interface

## Validation

Run these commands to verify completion:

```bash
# Should return no results
grep -r "constructor_name" packages/core/src/call_graph/constructor_calls/
grep -r "is_factory_method" packages/core/src/call_graph/constructor_calls/

# Should pass
npm test -- constructor_calls
```