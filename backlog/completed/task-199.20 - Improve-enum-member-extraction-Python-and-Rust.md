---
id: TASK-199.20
title: "Improve enum member extraction for Python and Rust"
status: Done
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

## Implementation Notes

### Changes Made

**`packages/types/src/symbol_definitions.ts`** — Added `symbol_id: SymbolId` to `EnumMember` interface so member identity is preserved through the pipeline.

**`packages/core/src/index_single_file/definitions/definitions.ts`**:

- `add_enum_member()` now stores `symbol_id` in the member value (previously only used as Map key)
- Added `find_enum_by_name()` — mirrors `find_class_by_name()` for enum lookups
- Added `add_method_to_enum()` — attaches impl methods to enum definitions, with lazy-initialized methods Map

**`packages/core/src/index_single_file/query_code_tree/capture_handlers/methods.rust.ts`** — All four method handlers (`handle_definition_method`, `handle_definition_method_associated`, `handle_definition_method_async`, `handle_definition_constructor`) now fall back to `find_enum_by_name` + `add_method_to_enum` when `find_class_by_name` returns undefined.

**`packages/core/src/index_single_file/type_preprocessing/member.ts`** — Enum section now extracts `enum_def.members` as properties and `enum_def.methods` as methods in `TypeMemberInfo`.

**`packages/core/src/index_single_file/type_preprocessing/member.test.ts`** — Updated 5 tests (2 TypeScript, 1 Python, 2 Rust) to assert correct enum member properties and methods instead of empty maps.

### Root Cause

- **Python**: `EnumMember` objects existed on `EnumDefinition.members` but `extract_type_members()` ignored them, producing empty properties.
- **Rust**: `find_containing_impl()` correctly extracted the type name, but `find_class_by_name()` only searched the classes Map. Enums live in a separate enums Map, so the lookup returned `undefined` and methods were silently dropped. The `EnumBuilderState.methods` field and `build_enum()` method already supported methods — only the lookup was missing.
