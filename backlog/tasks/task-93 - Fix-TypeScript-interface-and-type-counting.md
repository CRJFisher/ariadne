---
id: task-93
title: Fix TypeScript interface and type counting
status: To Do
assignee: []
created_date: '2025-08-03'
updated_date: '2025-08-03'
labels: []
dependencies: []
---

## Description

The function counting logic appears to be including TypeScript interfaces and type definitions as functions. This inflates the function count in TypeScript files. Need to ensure only actual functions/methods are counted.

## Acceptance Criteria

- [ ] Only actual functions and methods are counted
- [ ] TypeScript interfaces are not counted as functions
- [ ] Type definitions are not counted as functions

## Implementation Notes

Test cases from validation:
- src/types.ts: Reports 21 functions but likely includes interfaces and type definitions
- Need to distinguish between:
  * Actual functions: function foo() {}
  * Methods: class { method() {} }
  * Arrow functions: const foo = () => {}
  * NOT interfaces: interface Foo {}
  * NOT type aliases: type Foo = {}
  * NOT type declarations

The function counting should only include executable code, not type definitions.
