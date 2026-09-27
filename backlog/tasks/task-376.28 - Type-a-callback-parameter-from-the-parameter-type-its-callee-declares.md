---
id: TASK-376.28
title: Type a callback parameter from the parameter type its callee declares
status: To Do
assignee: []
created_date: '2026-09-27 18:55'
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.25
parent_task_id: TASK-376
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

A closure, arrow function or lambda passed as an argument receives its parameters from the callee, and the callee's declaration says what they are: `fn with_res<T>(&mut self, r: Restrictions, f: impl FnOnce(&mut Self) -> T)`, `each(cb: (item: Foo) => void)`, `def apply(cb: Callable[[Foo], None])`. Nothing reads that declaration for the callback's parameters. The value channel (`call_resolution/value_source.ts`) types a parameter only from its default, its own annotation, or the classes its call sites hand it, and a callback's parameter has none of those. So `self.with_res(r, |this| this.parse_expr())` ends `receiver_type_unknown`, and every method the callback calls on its parameter looks unreachable.

This is rustc's dominant parser idiom. TASK-376.25 measured 767 `|this|` sites that the old keyword reading reached only by coincidence, and that now honestly fail. The same gap exists in every language: a TypeScript arrow passed to a declared `(item: Foo) => void`, a JSDoc `@param {function(Foo): void}` callback, and a Python lambda passed to a `Callable[[Foo], None]` parameter.

Four facts are missing on the way:

- **Which argument the callback is.** `CallbackContext` records the receiving call's location, but not the callback's position among its arguments.
- **What a function-typed parameter hands its callback.** The annotation grammar reduces a function type to null, because a function type is not one named type (`type_preprocessing/annotation.ts`).
- **Rust method generics and `where` bounds.** A Rust method records no `generics`, and no Rust callable records a bound written in a `where` clause, so `fn with_g<F>(&mut self, f: F) where F: FnOnce(&mut Self)` has no text naming what `F` hands its closure. rustc writes 103 of its roughly 130 `Fn*(&Self)` bounds as `impl Fn*`, and the rest as a named generic, inline or in a `where` clause.
- **Python lambda parameters.** `lambda_parameters` is not captured, so a lambda's parameters are not definitions and `lambda f: f.m()` reads `f` from the enclosing scope, or from nothing.

## Work plan

1. Record the callback's argument position on `CallbackContext` in each language's callback detection. It is present only when the callback is itself an argument of the receiving call, not nested inside one.
2. Record Rust method generics, and fold `where`-clause bounds into the type parameters of both functions and methods.
3. Capture Python lambda parameters as parameters of the lambda's anonymous function.
4. Add a callable shape to `type_preprocessing/`: the parameter types a function-typed annotation hands its callback. Cover Rust `impl`/`dyn`/bare `Fn`/`FnMut`/`FnOnce(A, B) -> R` (through references and `Box`), TypeScript and JSDoc arrow types `(a: A, b: B) => R`, JSDoc `function(A, B)`, and Python `Callable[[A, B], R]`. A bare type parameter reads its declared bound.
5. Add a value-source producer for a callback parameter. Resolve the receiving call's callee, skip the declared receiver position that a method-call argument list does not bind, and read the callable shape of the parameter at the callback's position. The callback parameter then holds an instance of the type at its own position, resolved in the callee's scope, so Rust `Self` names the callee's impl type. It answers only where the callback parameter declares no annotation of its own.
6. Measure on rustc, tokio and a TypeScript corpus against TASK-376.25's candidate row, per failure reason.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A callback's argument position is recorded on its `CallbackContext` in all four languages, and Python lambda parameters are indexed as parameters of the lambda.
- [ ] #2 Rust methods record their generics, and a `where`-clause bound is the bound of the type parameter it names, for functions and methods alike.
- [ ] #3 A callback parameter with no annotation of its own holds an instance of the type its callee's function-typed parameter hands it at its position: Rust `impl`/`dyn`/generic `Fn*` bounds, TypeScript and JSDoc function types, and Python `Callable[[…], …]`.
- [ ] #4 `Project`-tier integration tests cover rustc's `self.with_res(r, |this| this.parse())` in its `impl FnOnce`, inline-bound and `where` forms, a TypeScript arrow passed to a declared callback type, a JavaScript callback typed by JSDoc, and a Python lambda passed to a `Callable` parameter.
- [ ] #5 Per-reason recovery is measured on rustc and tokio against TASK-376.25's candidate row, and on one TypeScript corpus.
<!-- AC:END -->
