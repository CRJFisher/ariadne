---
id: TASK-199.23
title: "Fix: namespace-qualified constructor binding resolution (new X.Class())"
status: To Do
assignee: []
created_date: "2026-04-01 13:25"
labels:
  - enhancement
  - call-resolution
  - typescript
dependencies:
  - TASK-199.18
references:
  - packages/core/src/index_single_file/type_preprocessing/constructor.ts
  - packages/core/src/resolve_references/registries/type.ts
  - packages/core/src/resolve_references/resolve_references.typescript.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

When a constructor call uses a namespace-qualified name (`const user = new models.User(name)`), the constructor binding system extracts the unqualified type name `User`. However, `User` is not directly resolvable in the consumer's scope — only the namespace `models` is. So `resolutions.resolve(scope_id, "User")` returns null and the variable gets no type binding, meaning subsequent method calls on the variable (`user.greet()`) cannot resolve.

This was discovered during task-199.18 and documented in the namespace constructor integration test.

### Root Cause

`extract_constructor_bindings` in `type_preprocessing/constructor.ts` extracts `ref.name` from the `constructor_call` reference. For `new models.User(name)`, `ref.name` is `User` (unqualified). Then `TypeRegistry.resolve_type_metadata()` step 1 calls `resolutions.resolve(scope_id, "User")` which fails because `User` isn't in scope — it's only accessible as `models.User`.

### Possible Fix Approaches

1. **Resolve through namespace at type binding time**: When the constructor_call has a namespace-qualified receiver (detectable from the reference's property_chain or a new field), resolve the type by first resolving the namespace import, then looking up the class name in the target module's exports.
2. **Store qualified name in constructor binding**: Extract `models.User` instead of just `User`, then add qualified name resolution to the type binding step.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 const user = new models.User(name); user.greet() resolves greet() to the User class method, where models is a namespace import
- [ ] #2 Existing non-namespace constructor bindings (const user = new User(name)) continue to work unchanged
<!-- AC:END -->
