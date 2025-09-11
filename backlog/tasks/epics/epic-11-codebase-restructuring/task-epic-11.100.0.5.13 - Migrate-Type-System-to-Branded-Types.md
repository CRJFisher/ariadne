---
id: task-epic-11.100.0.5.13
title: Migrate Type System to Branded Types
status: To Do
assignee: []
created_date: '2025-09-11 18:35'
labels: []
dependencies: ['task-epic-11.100.0.5.9', 'task-epic-11.100.0.5.10']
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Replace all raw strings in type analysis modules with appropriate branded types including TypeString, TypeConstraint, and DefaultValue.

## Acceptance Criteria

- [ ] All `type?: string` replaced with `type?: TypeString`
- [ ] All `return_type?: string` replaced with `return_type?: TypeString`
- [ ] All `constraint?: string` replaced with `constraint?: TypeConstraint`
- [ ] All `default?: string` and `default_value?: string` replaced with `DefaultValue`
- [ ] Parser functions for complex type strings (generics, unions, etc.)
- [ ] Validators for type string formats

## Scope

### Current Issues

```typescript
// BEFORE - Unsafe
interface TypeInfo {
  readonly type?: string;
  readonly return_type?: string;
  readonly constraint?: string;
  readonly default_value?: string;
}

// AFTER - Type-safe
interface TypeInfo {
  readonly type?: TypeString;
  readonly return_type?: TypeString;
  readonly constraint?: TypeConstraint;
  readonly default_value?: DefaultValue;
}
```

### Complex Type Parsing

Need parsers for:
- Generic types: `Array<string>`, `Promise<void>`
- Union types: `string | number`
- Intersection types: `A & B`
- Tuple types: `[string, number]`
- Function types: `(x: number) => string`

## Affected Modules

- type_tracking
- return_type_inference
- parameter_type_inference
- type_propagation
- generic_resolution

## Dependencies

- Depends on Task 11.100.0.5.9 (Branded Type Infrastructure)
- Depends on Task 11.100.0.5.10 (Compound Type Builders)