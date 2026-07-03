---
id: TASK-201
title: Fix Rust enum impl methods not attached to EnumDefinition
status: To Do
assignee: []
created_date: "2026-03-29 20:13"
labels:
  - bug
  - indexer
  - rust
dependencies: []
references:
  - packages/core/src/index_single_file/definitions/definitions.ts
  - >-
    packages/core/src/index_single_file/query_code_tree/capture_handlers/methods.rust.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

When indexing Rust code with an enum that has an impl block, the impl methods are NOT attached to `EnumDefinition.methods`. Struct impl methods ARE correctly attached to `ClassDefinition.methods`.

```rust
enum MyResult {
    Ok(i32),
    Err(String)
}

impl MyResult {
    fn is_ok(&self) -> bool { true }  // NOT attached to EnumDefinition
}
```

## Root Cause

Two pieces are missing in `DefinitionBuilder` (`definitions.ts`):

1. **No `find_enum_by_name()`** — `find_class_by_name()` exists for structs, `find_interface_by_name()` exists for traits, but there is no enum equivalent.

2. **No `add_method_to_enum()`** — `add_method_to_class()` exists, `add_method_signature_to_interface()` exists, but no enum equivalent. The `EnumBuilderState` already has an optional `methods` field and `build_enum()` already builds methods if present — the setter is simply missing.

3. **Method handler only checks structs** — In `methods.rust.ts`, `handle_definition_method()` only calls `builder.find_class_by_name(impl_info.struct_name)`, never checking if it's an enum.

## Fix

1. Add `find_enum_by_name()` to `DefinitionBuilder`
2. Add `add_method_to_enum()` to `DefinitionBuilder`
3. Update method handlers in `methods.rust.ts` to fall through to enum lookup if class lookup fails

## Files to modify

- `packages/core/src/index_single_file/definitions/definitions.ts` — Add 2 methods
- `packages/core/src/index_single_file/query_code_tree/capture_handlers/methods.rust.ts` — Add enum fallback

## Impact

- Rust enum methods (e.g., `impl Result { fn is_ok() }`) are invisible to call graph analysis
- Discovered in task-199.6 via type_preprocessing integration tests
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Rust enum impl methods appear in EnumDefinition.methods
- [ ] #2 extract_type_members returns enum methods for Rust enums with impl blocks
- [ ] #3 Existing tests continue to pass
<!-- AC:END -->
