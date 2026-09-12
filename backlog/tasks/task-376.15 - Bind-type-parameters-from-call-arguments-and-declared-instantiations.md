---
id: TASK-376.15
title: "Bind type parameters from call arguments and declared instantiations"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.11
parent_task_id: TASK-376
priority: high
ordinal: 15000
plan_dedup_keys:
  - f20fd6df1709d43b0248e00e6c73562934f126d0ef09b8d1afc778b8d431e3d5
plan_source_tasks:
  - pt-60cd5f0fe08cfb4c
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 16. Wave 6, beside TASK-376.8 and TASK-376.14. Requires TASK-376.11 — logically only TASK-376.6's `parse_type_annotation`, but it rewrites `receiver_resolution.ts`, which TASK-376.10 and TASK-376.11 edit first.

## Root cause

`infer_generic_return_from_type_token` (`call_resolution/receiver_resolution.ts:587-618`) matches a method's parameters against its return type through a single-argument unwrap (`:603-607`; `parse_single_type_argument` until TASK-376.6 replaces it with `parse_type_annotation`), so only a `Wrapper<T>` parameter whose argument is the bare return type binds anything, and `Type<T> | null`, `Map<K, V>` and every declared instantiation or bound are rejected. There is no type-parameter environment, so a generic method's return type cannot be resolved from the call site's arguments — the binding evidence is per call site (the token is carried on the reference's `property_chain_arguments` and resolved at `:632`), not per symbol.

## Work plan

1. Generalise `infer_generic_return_from_type_token`: parse the method's parameter annotations with `parse_type_annotation`, unify each against the call argument's resolved type to bind the method's `generics`, then resolve the return annotation in that environment.
2. Seed the environment additionally from declared instantiations (`const p: Provider<Foo>` binding `T = Foo`, read from `symbol_type_arguments`) and from `extends` / trait bounds (`fn walk<V: Visitor>` binding `V` to `Visitor`, `class C<T extends Base>` binding `T` to `Base`).
3. Fold the DI type-token shape in as one case of the general mechanism rather than a special path.
4. Add unit tests for unification: a parameter `Type<T>` against argument `Foo` binds `T = Foo`; `Map<K, V>` against `Map<string, Foo>` binds both; an unbound parameter leaves the return unresolved rather than guessing.
5. Add integration tests (fixtures under `tests/fixtures/{typescript,rust}/code/integration/`) covering every evidence case for this step: angular DI `inject(Router)` / `get(Type<T>)` yielding the injected type's methods; `Provider<Foo<Bar>>` nested-argument resolution; a TypeScript generic factory `create<T>(c: Type<T>): T` whose result receives a method call; a Rust `fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }` binding `V` through its trait bound; and a call whose type parameter cannot be bound, asserting the receiver stays unresolved rather than mis-typed.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A type-parameter environment is bound from call arguments, declared instantiations and `extends`/trait bounds, and the return annotation is resolved in that environment.
- [ ] #2 The DI type-token shape resolves as one case of the general mechanism, with no single-argument special case remaining.
- [ ] #3 An unbindable type parameter leaves the receiver unresolved rather than producing a wrong type.
- [ ] #4 Integration tests cover all of this step's evidence cases: `inject(Router)` / `get(Type<T>)`, `Provider<Foo<Bar>>`, a generic factory result receiver, the Rust `fn walk<V: Visitor>` bound, and the unbindable case.
- [ ] #5 Unit tests cover unification for `Type<T>`, `Map<K, V>` and the unbound case.

<!-- AC:END -->
