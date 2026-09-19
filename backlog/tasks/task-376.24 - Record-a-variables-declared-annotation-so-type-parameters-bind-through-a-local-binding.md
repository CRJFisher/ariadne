---
id: TASK-376.24
title: >-
  Record a variable's declared annotation so type parameters bind through a
  local binding
status: To Do
assignee: []
created_date: "2026-09-19 11:36"
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.15
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`declared_annotation` (`resolve_references/type_parameter_environment.ts`) accepts four definition kinds — `parameter`, `variable`, `constant`, `property` — and reads the annotation text off `def.type`. The indexer records no `type` on a variable or a constant: `const routers: Array<Router> = []` and `let single: Router = new Router()` both index into the `variables` bucket (kinds `constant` and `variable`) with `type: undefined`, while a parameter carrying the same annotation records it. So two of the four branches never answer, and every caller reading an annotation off a local binding is in fact reading parameters and properties alone.

What it costs on the capability surface: type-parameter binding cannot see through a local variable, so the same code resolves or not depending only on whether the binding is a parameter or a `const`.

- `concrete_argument_type` reads a value argument's type from its declaration, so `const routers: Array<Router> = []; first_of(routers).navigate()` binds nothing, where `function call_site(routers: Array<Router>)` binds `T = Router` today.
- `bind_from_declared_instantiation` (`call_resolution/type_parameter_resolution.ts`) reads the receiver's own instantiation the same way: `const p: Provider<Foo>` cannot bind `Provider`'s `T`, though a parameter `p: Provider<Foo>` does — the case `type_parameter_resolution.test.ts` › "resolves a method returning the type argument its receiver was declared with" pins in parameter form only.
- `resolve_type_parameter_annotation` cannot type a local annotated with a type parameter (`let v: V = …` inside `fn walk<V: Visitor>`), the binding-shaped half of the receiver TASK-376.15 built for parameters.

Each miss leaves the call unresolved and its target looking unreachable — the false-positive entry point the TASK-376 line exists to remove.

The fix is in the indexer, not in this module: a variable's or constant's declared annotation has to reach the definition's `type` field, recorded by the symbol factories where a parameter's already is. The `type_preprocessing` parse-and-unify path needs no change — it is shared, and answers as soon as the text arrives.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A variable or constant declaring an annotation records it on the definition's `type`: `const routers: Array<Router> = []` indexes as `type: "Array<Router>"`, asserted for TypeScript, Rust (`let r: Vec<Router>`) and Python (`routers: list[Router]`) in the owning `symbol_factories.*.test.ts`.
- [ ] #2 `declared_annotation` is reached for all four kinds its guard accepts — a unit case per kind in `type_parameter_environment.test.ts` — or any kind that remains unreachable is deleted from the guard rather than left dead.
- [ ] #3 `type_parameter_resolution.test.ts` gains the local-binding counterpart of each parameter-form case passing today: a factory argument held in a `const`, a receiver `const p: Provider<Foo>` binding `Provider`'s `T`, and a Rust local annotated with a bounded parameter.
- [ ] #4 The per-corpus failure ledger is re-run and the `member_type_unknown` count restated against TASK-376.18's baseline, showing the recovery and no new false edges.
<!-- AC:END -->
