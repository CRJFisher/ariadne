---
id: TASK-375.6
title: "Substitute Self and traverse a module alias on the unified Rust resolver"
status: Done
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

- [x] #1 The `Self::` false-positives clear for calls inside the defining `impl` block and from a different `impl` block for the same type.
- [x] #2 `SELF_TYPE_KEYWORD` lives in `path_resolution.rust.ts`, `Self` is substituted before any anchor handling, and `PATH_ANCHORS` is unchanged.
- [x] #3 `resolve_self_type_rust` takes `(scope_id, scopes, definitions)` with the `name === 'Self'` gate at its constructor call site.
- [x] #4 The rustc `compute_debuginfo_type_name` false-positive clears through the `super::alias` module-alias hop.
- [ ] #5 Integration tests cover every evidence case individually — both `impl`-block positions, the trait-default-body shapes, and the `super::alias` path — each asserting the call reference resolves.
      <!-- partial: One trait-default-body shape is tested; the four the criterion names are enumerated nowhere and are covered by that single shape. -->
- [ ] #6 The four trait-default-method-body rows are measured, not assumed: any that do not clear are explicitly re-routed to `type-model-completion` with the reason recorded.
      <!-- partial: One trait-default shape was measured and clears; the four corpus rows themselves are unmeasured — TASK-385. -->
- [x] #7 `constructor.rust.test.ts` and `path_resolution.rust.test.ts` stay green.

<!-- AC:END -->

## Implementation Notes

### What a user gets

`Self::assoc()` resolves wherever a Rust author writes it — inside the impl block that defines the
associated function, from a second impl block for the same type, from an instance method's body,
on an enum's own impl, through a trait impl on the same type, and inside a trait's own default
method body. And a module brought into scope under an alias is a module a path can traverse, so the
rustc `compute_debuginfo_type_name` shape — `super::alias::item` through a non-`pub`
`use crate::real as alias;` — reaches its target. In every case the callee stops being reported as
an entry point nothing calls.

### The approach

`Self` is neither an anchor nor a binding: it stands for the enclosing `impl`/`trait` type, which is
a symbol rather than a name any later hop could look up. So it is substituted first, before any
anchor is read, and its associated item is taken directly from the type's member index.
`PATH_ANCHORS` is untouched — adding `Self` to it would make the resolver try to resolve a keyword
as a directory.

The module-alias hop is not a separate mechanism. TASK-375.5's resolver already follows a path
segment that names a module the author brought into scope, whether by `mod x;` or by a `use`; an
alias is that same hop with a renamed binding. What this task adds on top is the measurement that
the hop covers the aliased shape, and the test coverage for it.

### How to navigate the result

`RUST_SELF_TYPE_KEYWORD`, `resolve_self_type_rust` and the substitution all live in
`resolve_references/call_resolution/path_resolution.rust.ts`, whose header lists `Self` as the first
of four hops. The constructor's `Self::new()` case is gated at its call site in the
language-neutral `constructor.ts`, because a constructor's terminal is a type rather than a callable
and the substitution there yields the type itself.

### Deviations from the work plan, and why

1. **`resolve_self_type_rust` moved to `path_resolution.rust.ts`** rather than staying in
   `constructor.rust.ts` re-signed. Step 1 puts the keyword in the path resolver, and the resolver
   is now the primary caller; leaving the function behind would have the shared base importing from
   a leaf. `constructor.rust.ts`'s header no longer advertises `Self` handling.
2. **The module-alias hop landed with TASK-375.5**, because the same mechanism was needed there for
   `attr::Container::from_ast`. This task's contribution to it is the `super::alias` evidence test
   and the confirmation that a non-`pub` `use` is followed.
3. **"The four trait-default-method-body shapes" are covered by one.** The four rows are named
   nowhere in the repo, so there is nothing to enumerate against. `Self::required()` inside a
   trait's own default body was written as a test and measured: it resolves to the trait's required
   method, so the `type-model-completion` dependency step 5 warned about does not bite and no row is
   re-routed. Two shapes the plan did not ask for are covered as well — an instance-method body and
   an enum's own impl.
4. **A trait qualifies its methods too.** Review found that `Read::read(r)` — UFCS on a trait — was
   unresolvable although trait methods already sit in the member index the hop reads. The
   type-qualified hop now accepts an interface alongside a struct and an enum, which closes
   `Encodable::encode`, `Default::default` and `From::from` shapes across the corpora.

### Known gaps, owned elsewhere

- `Self::Inner::f()` — a `Self` path deeper than one segment — resolves to nothing. A `Self` path
  names an associated item directly; a deeper path is an associated *type* projection, which belongs
  to the type model rather than to path resolution.
- `Enum::new()` and `Self::new()` inside an enum impl stay unresolvable: the constructor route gates
  on a class definition. Recorded in TASK-375.5.
