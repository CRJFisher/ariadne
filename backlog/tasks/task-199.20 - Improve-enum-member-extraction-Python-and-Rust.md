---
id: TASK-199.20
title: "Improve enum member extraction for Python and Rust"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - enhancement
  - type-preprocessing
  - python
  - rust
dependencies: []
references:
  - packages/core/src/index_single_file/type_preprocessing/
  - packages/core/src/index_single_file/type_preprocessing/member.test.ts
parent_task_id: TASK-199
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Two enum-related extraction gaps found during the task-199 epic:

### Python Enum members not surfaced

`class Color(Enum): RED = 1; GREEN = 2; BLUE = 3` is indexed as a regular class with zero methods, zero properties, and no constructor. The enum-specific members (`RED`, `GREEN`, `BLUE`) are not extracted as properties. This means enum member access (`Color.RED`) cannot be resolved through the type system.

Found in task 199.6.1. Test at `member.test.ts` lines 683-688 documents the current (empty) behavior.

### Rust enum impl methods not attached

Methods defined in `impl` blocks for Rust enums are not attached to the enum definition. This means `MyEnum::variant_method()` cannot be resolved. The test documents this: `expect(methods.size).toBe(0)`.

Found in task 199.6.1.

### Actions

1. Python: modify enum extraction to capture class-body assignments as enum member properties
2. Rust: investigate whether enum impl methods can be attached via the same mechanism used for struct impl blocks
3. Update existing tests to assert the new correct behavior
<!-- SECTION:DESCRIPTION:END -->
