---
id: TASK-376.15
title: "Bind type parameters from call arguments and declared instantiations"
status: Done
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

## Carried from TASK-376.10

TASK-394's eleven `dispose` sites are disposed through `codeEditorContributions.ts`'s `_instances = this._register(new DisposableMap<string, IEditorContribution>())`. TASK-376.10 types a container's element from its annotation or its literal's constructions, but this field has neither: its element is reachable only by binding `_register<T>(o: T): T`'s `T` from the argument and reading the construction's own type arguments. Add that shape to step 5's evidence cases, and replace the annotated stand-in in `tests/fixtures/typescript/code/integration/container_elements/contributions.ts` with the real one.

## Carried from TASK-376.13

TASK-376.13's evidence case `fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }` fanning to every `impl Visitor for T` stops before method lookup: the receiver `v` ends `receiver_type_unknown` because `V` is not bound to its trait bound. TASK-376.13 pins the trait fan-out through a `dyn Visitor` receiver in `tests/fixtures/rust/code/integration/subtype_dispatch/walk.rs` (`project.integration.test.ts` › "Dispatch through a subtype closure, whatever order files arrive in"). When step 2 binds `V` to `Visitor`, add a generic-bound `walk` beside it and assert the same `[Visitor.visit_item, Collector.visit_item, Counter.visit_item]` fan-out, in every arrival order, through the existing order matrix.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 A type-parameter environment is bound from call arguments, declared instantiations and `extends`/trait bounds, and the return annotation is resolved in that environment.
- [x] #2 The DI type-token shape resolves as one case of the general mechanism, with no single-argument special case remaining.
- [x] #3 An unbindable type parameter leaves the receiver unresolved rather than producing a wrong type.
- [x] #4 Integration tests cover all of this step's evidence cases: `inject(Router)` / `get(Type<T>)`, `Provider<Foo<Bar>>`, a generic factory result receiver, the Rust `fn walk<V: Visitor>` bound, and the unbindable case.
- [x] #5 Unit tests cover unification for `Type<T>`, `Map<K, V>` and the unbound case.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### What the capability surface gained

A call on anything a generic produces used to dead-end. Three receiver shapes now resolve:

- a chained hop through a generic member (`injector.get(Router).navigate()`, `provider.get().run()`),
- a binding a generic factory initialises (`const r = create(Router); r.navigate()`),
- an identifier whose own annotation names a type parameter (`fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }`), which reaches the bound's members and then fans out over every implementer exactly as a `dyn Visitor` receiver does.

Measured on the committed Rust corpus, the bound alone recovered the one call
`heritage_trait_impls/visit.rs` had left unresolved — TASK-376.13's carried evidence case —
taking the corpus from 128 resolved / 54 failed to 129 / 53.

### Mechanism

- `TypeParameter { name, bound? }` replaces the bare `SymbolName[]` of `generics`, so Rust's
  first trait bound and TypeScript's `extends` constraint survive indexing. TypeScript's plain
  function declarations record `generics` for the first time; only classes, methods, interfaces
  and type aliases did before.
- `type_preprocessing/type_parameter_binding.ts` is the pure unifier: annotation against
  annotation, binding annotations rather than symbols so `Map<K, V>` against `Map<string, Foo>`
  binds `V` to a type and `K` to text that names none.
- `type_parameter_environment.ts` owns the whole sequence — bind the evidence, substitute the
  annotation, resolve what comes out — with one optional tier per evidence source. All three
  consumers call it rather than reassembling the steps, which is why the factory, the chained
  hop and the annotated binding agree by construction rather than by hand-kept copies. It
  queries the registries for an argument's declaration, which is what keeps it out of the pure
  `type_preprocessing/`.
- `call_resolution/type_parameter_resolution.ts` holds the receiver-shaped evidence only: which
  type parameters are in scope for a receiver, and what its declared instantiation binds, handed
  to the environment as a binder because the registries never import call resolution.
- `type_token_return.ts` is deleted. The DI token is now the general rule's third unification
  case: a one-argument wrapper that is not a container shape, handed a name that designates a
  type rather than a value.

### Left open

TASK-376.10's carried `_register` shape — vscode's
`_instances = this._register(new DisposableMap<string, IEditorContribution>())` — is not
reached, and `tests/fixtures/typescript/code/integration/container_elements/contributions.ts`
keeps its annotated stand-in. The environment binds `_register<T>(o: T): T` from arguments, but
three facts it needs are not recorded anywhere: a class field keeps no call initialiser (only a
variable does), a construction argument is not an identifier so it occupies its position as
`null`, and a container's element is read from a binding's own annotation rather than from a
bound type parameter's arguments. Each is its own indexing change; the fixture comment states
this.

A bound annotation resolves only through a bare head. A qualified one (`a.b.T`) needs the
annotation resolver the `TypeRegistry` owns, which runs at index time rather than at call time.

<!-- SECTION:NOTES:END -->
