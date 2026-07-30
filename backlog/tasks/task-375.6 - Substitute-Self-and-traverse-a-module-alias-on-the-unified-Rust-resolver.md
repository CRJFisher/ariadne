---
id: TASK-375.6
title: "Substitute Self and traverse a module alias on the unified Rust resolver"
status: To Do
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-375
priority: high
ordinal: 6000
plan_dedup_keys:
  - e328abbeace696eba965a5852d6dbf4e41dd274e59ff2cb84320e0f7ec604a23
plan_source_tasks:
  - pt-d5fdde53b814dd3a
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`Self::` is the module-surface starvation in miniature: `PATH_ANCHORS` (`path_resolution.rust.ts:31`) is `{crate, self, super}` and `Self` is neither an anchor nor a binding, so a `Self::assoc()` path has nothing to resolve against. Separately, `compute_debuginfo_type_name` reaches its target through a non-`pub` `use` of a module acting as a module alias that a `super::alias::item` path traverses — one hop beyond the `crate_roots` lookup that closes the other two cross-crate rows.

Both are thin adapters on the unified resolver from sub-task 1.5 and are trivially small once it exists.

## Work plan

1. Move `SELF_TYPE_KEYWORD` from `constructor.rust.ts:44` into `path_resolution.rust.ts` and substitute a leading `Self` segment for the enclosing `impl` type **before anything else** in the unified resolver. Do not add `Self` to `PATH_ANCHORS`.
2. Re-sign `resolve_self_type_rust` (`constructor.rust.ts:53`): drop its `call_ref` parameter and its `call_ref.name !== SELF_TYPE_KEYWORD` guard, taking `(scope_id, scopes, definitions)`; move the `name === 'Self'` gate to its constructor call site.
3. Add the `super::alias` module-alias hop: when a path segment resolves to a non-`pub` `use` of a module rather than to a file or a type, follow it and continue the file hop from the aliased module. Keep it inside the unified resolver so both the callable and type terminals get it.
4. Add integration tests in `resolve_references.rust.test.ts` covering **every** evidence case, not one representative: `Self::assoc()` from within the defining `impl` block; `Self::assoc()` from a _different_ `impl` block for the same type; `Self::assoc()` where the associated function is inherited through the type's own impl; the four trait-default-method-body shapes where `Self` is a type parameter; and the rustc `compute_debuginfo_type_name` shape — a `super::alias::item` path traversing a non-`pub` module-alias `use`.
5. Verify the four trait-default rows before claiming them: substituting the enclosing impl/trait binds them to the trait's own associated function, and whether that clears the flag depends on `type-model-completion`'s subtype expansion. If it does not, re-route those four rows explicitly rather than counting them here.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The `Self::` false-positives clear for calls inside the defining `impl` block and from a different `impl` block for the same type.
- [ ] #2 `SELF_TYPE_KEYWORD` lives in `path_resolution.rust.ts`, `Self` is substituted before any anchor handling, and `PATH_ANCHORS` is unchanged.
- [ ] #3 `resolve_self_type_rust` takes `(scope_id, scopes, definitions)` with the `name === 'Self'` gate at its constructor call site.
- [ ] #4 The rustc `compute_debuginfo_type_name` false-positive clears through the `super::alias` module-alias hop.
- [ ] #5 Integration tests cover every evidence case individually — both `impl`-block positions, the trait-default-body shapes, and the `super::alias` path — each asserting the call reference resolves.
- [ ] #6 The four trait-default-method-body rows are measured, not assumed: any that do not clear are explicitly re-routed to `type-model-completion` with the reason recorded.
- [ ] #7 `constructor.rust.test.ts` and `path_resolution.rust.test.ts` stay green.

<!-- AC:END -->
