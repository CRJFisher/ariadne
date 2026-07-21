---
id: TASK-360
title: Resolve generic return type from type-token arguments (`injector.get(Token).m()`)
status: Done
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - call-resolution
  - typescript
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A dependency-injection lookup like `injector.get(Token).method()` cannot be
resolved because Ariadne does not infer the generic return type of
`Injector.get<T>(token: Type<T>): T` from the token argument. The base
`injector` resolves and member `get` is found, but resolution then fails with
`member_type_unknown` (the return type `T` is never bound from the `Token`
argument), so the chained method call drops.

TypeScript itself resolves this — the type token is the static call argument — so
it is a fixable inference gap, not a permanent limitation. Surfaced by
TASK-190.30.1's follow-up triage of the keep-pending wip classifiers, which
removed the `dependency-injection-type-resolution` suppressor (a deferred-feature
classifier, observed once in angular) and routed the underlying fix here.

### Origin (removed classifier row this tracks)

`dependency-injection-type-resolution` (builtin, observed_count 1, angular).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `injector.get(Token).method()` resolves `method` against the class the token
      resolves to (generic return type inferred from the `Type<T>` argument).
- [x] The general shape — a method whose return type is a generic parameter bound
      by a type-token argument — propagates that type into chained-receiver resolution.
- [x] Regression test covers the `injector.get(Token).method()` chain.

<!-- AC:END -->

## Implementation Notes

### High-level summary

Chained calls whose receiver is a generic dependency-injection lookup —
`injector.get(Token).method()` — resolve their trailing method against the class
the token designates. When a chain member is a generic method whose return type
is one of its own type parameters bound by a type-token parameter
(`get<T>(token: Type<T>): T`), receiver resolution infers the concrete return
type from the token argument passed at that call site, and the chain continues
against the inferred class.

Two capabilities make this work, one per pipeline stage:

- **Capture (`index_single_file`)** records, alongside a method call's
  `property_chain`, an index-aligned `property_chain_arguments` array: for each
  chain position that is an invoked call, the positional identifier argument
  names (`null` for a non-identifier argument, preserving its index; the whole
  entry `null` where the position is not a call). The field is attached only when
  an intermediate chain position carries an identifier argument, so ordinary
  method-call references that gain no inference value keep their existing shape.
  The aligned array is produced in one traversal shared with `property_chain`, so
  the two never drift.
- **Resolution (`resolve_references`)** carries the arguments onto
  `ReceiverExpression` (sliced identically to the property chain) and, in
  `walk_property_chain`, infers the generic return in the previously-terminal
  `member_type_unknown` fallback. Inference fires only when the method's return
  type is one of its declared `generics` **and** a parameter's declared type
  parses as `Wrapper<return-type>`; it resolves the token argument to a class
  used directly (`injector.get(Service)`), or through a parameter's own
  `Type<Concrete>` annotation. Because it runs only where resolution previously
  dead-ended, it can add resolutions but never alter a succeeding one.

### How the acceptance criteria are addressed

- **`injector.get(Token).method()` resolves against the token's class** — the
  integration test "injector.get(Token).method() resolves the method against the
  token class" drives the full pipeline on the class-token form (the canonical
  Angular `injector.get(SomeService)`), asserting the trailing `handle` resolves
  to `Service.handle`. A cross-file variant confirms an imported token class
  resolves too.
- **The general shape propagates into chained-receiver resolution** — inference
  keys off the structural predicate, not any specific name: a differently-named
  `Container.resolve<R>(marker: Provider<R>): R` chain resolves, and a
  multi-generic method (`get<K, T>(key: Key<K>, token: Type<T>): T`) selects the
  parameter that binds the return type (index 1), not the first parameter.
  Parameter-typed tokens (`token: Type<Service>`) resolve through the annotation.
- **Regression test covers the chain** — the class-token integration test is the
  regression guard; negative tests assert inference declines (leaving
  `member_type_unknown`) when the token parameter is absent or is a
  multi-argument generic.

### Key changes

- `packages/types/src/symbol_references.ts` — new `ChainCallArguments` type;
  `MethodCallReference.property_chain_arguments`.
- `packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.javascript.ts`
  — shared `build_property_chain` traversal producing chain + aligned arguments;
  `extract_receiver_info` attaches them (shared by TypeScript by delegation).
- `packages/core/src/index_single_file/references/{factories,references}.ts` —
  thread the field onto the reference.
- `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts` —
  `ReceiverExpression.chain_arguments`; the type-token inference and its
  `resolve_token_argument_type` / `parse_single_type_argument` helpers.
- `packages/core/src/persistence/cache_manifest.ts` — `CURRENT_SCHEMA_VERSION`
  bumped to `3` so an on-disk index cache written before this change is
  discarded and re-indexed, ensuring the new capture field (and therefore the
  inference) applies to already-cached files rather than being silently skipped.

### Boundaries (deliberately out of scope)

- **Local `const`/`let` tokens** (`const TOK: Type<Service>; injector.get(TOK)…`)
  do not resolve yet: variable/constant type annotations are not captured at
  index time (a separate, pre-existing gap). The inference already handles this
  binding shape and lights up once that capture gap closes; parameter-typed
  tokens exercise the same branch today.
- **Self-reference receivers** (`this.injector.get(Token)…`) are not covered:
  `SelfReferenceCall` carries no `property_chain_arguments`. The acceptance
  criteria specify the identifier-base form; extending to the self-reference base
  mirrors the same field onto `SelfReferenceCall`.
- **Non-identifier token arguments** (`get(new X())`, `get(a.b)`) are captured as
  `null` placeholders and inference declines by design.
