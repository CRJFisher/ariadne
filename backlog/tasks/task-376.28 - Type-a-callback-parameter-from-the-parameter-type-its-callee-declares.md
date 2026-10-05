---
id: TASK-376.28
title: Type a callback parameter from the parameter type its callee declares
status: Done
assignee: []
created_date: '2026-09-27 18:55'
updated_date: '2026-09-27 22:03'
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
- [x] #1 A callback's argument position is recorded on its `CallbackContext` in all four languages, and Python lambda parameters are indexed as parameters of the lambda.
- [x] #2 Rust methods record their generics, and a `where`-clause bound is the bound of the type parameter it names, for functions and methods alike.
- [x] #3 A callback parameter with no annotation of its own holds an instance of the type its callee's function-typed parameter hands it at its position: Rust `impl`/`dyn`/generic `Fn*` bounds, TypeScript and JSDoc function types, and Python `Callable[[…], …]`.
- [x] #4 `Project`-tier integration tests cover rustc's `self.with_res(r, |this| this.parse())` in its `impl FnOnce`, inline-bound and `where` forms, a TypeScript arrow passed to a declared callback type, a JavaScript callback typed by JSDoc, and a Python lambda passed to a `Callable` parameter.
- [x] #5 Per-reason recovery is measured on rustc and tokio against TASK-376.25's candidate row, and on one TypeScript corpus.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What the capability surface gained

A callback passed as an argument receives what its callee's declaration says it receives, so calls on its parameters reach their methods:

- **Rust:** `self.with_res(r, |this| this.parse())` against `f: impl FnOnce(&mut Self) -> T`, an inline `<F: FnMut(&mut Self)>`, or `where F: FnOnce(&mut Self) -> T`.
- **TypeScript:** an arrow passed to `cb: (item: Foo, i: number) => void`, through parentheses and `| undefined`. A generic callee binds `T` from the call's other arguments: `map(foos, (x) => x.m())` with `foos: Foo[]`.
- **JavaScript:** a callback typed by JSDoc `{function(Foo): void}` or `{(f: Foo) => void}`.
- **Python:** a lambda passed to `Callable[[Foo], None]` (also inside `Optional`), through an instance or through the class (`Registry.each(registry, lambda f: …)`).

A parameter annotated in its own right keeps its annotation. A type parameter nothing binds holds nothing, and never matches an unrelated type spelled `T`.

## Mechanism

- **Indexing.** `CallbackContext.argument_index` is the callback's position among the receiving call's arguments, seen through parentheses, and null when it is only written inside one (`argument_position.ts`). Python lambda parameters are captured. Rust methods record `generics`, and a `where` bound is its parameter's bound for functions and methods alike.
- **`type_preprocessing/callable_shape{,.rust,.typescript,.javascript,.python}.ts`** read the parameter types a function-typed annotation hands its callable, one entry per position.
- **`value_source.ts` producer 6** finds the receiving call in the reference registry, resolves its callee through the name chain, skips a declared receiver the call supplies implicitly, and reads the shape at the callback's position. A type naming the callee's type parameters goes through `resolve_annotation_in_environment` (call arguments, then bounds); any other resolves through `lookup_annotation` in the callee's scope, so Rust `Self` is the callee's impl type.
- **`ReceiverResolutionContext` carries `references`**, and `resolve_method_call` takes that context whole instead of nine registries.

## Measured

Interleaved arms, control `c36c50eb` (TASK-376.29), builds guarded by TASK-399. The guard refused the first attempt because the candidate's `core` build was stale, and the arms below ran after a rebuild.

| Corpus | Resolved | Edges | Raw entry points |
| --- | ---: | ---: | ---: |
| rustc (376.18's predicate) | 113076 → **114585** (+1509) | 95959 → 97890 | 19735 → 19488 |
| tokio (`repository-root`) | 8952 → 8980 (+28) | 7868 → 7895 | 2344 → 2339 |
| vscode `folder-ts:src/vs/base` | 32632 → 32644 (+12) | 39984 → 40007 | 1283 → 1281 |

rustc per reason: `receiver_type_unknown` −1955, `method_not_on_type` +230, `member_type_unknown` +210. No call resolved in any control became unresolved. rustc lists five control-only edges; one is `as_str#1` → `#2`, a second call to the same target now resolving. The other four target `discard_err`/`align_to` from functions with several such calls, and are read as the same count change, though the truncated diff does not show their counterparts. rustc now resolves above TASK-376.18's achieved row (113,204). TASK-376.25's `|this|` residue was 767 sites.

## Not covered

- A call on a fresh construction (`new H().each(cb)`, `H().each(cb)`): the chain has no named root to resolve the callee through.
- A Python lambda bound to a name (`g = lambda f: …`) is no anonymous function, so its parameters still attach to nothing.
- A callback type named through an alias (`type Cb = (x: Foo) => void`) or an interface call signature: the shape reads written function types only.
<!-- SECTION:NOTES:END -->
