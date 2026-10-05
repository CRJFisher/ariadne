---
id: TASK-353
title: Propagate `as`-cast target type into receiver resolution for `(x as Concrete).m()`
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

`extract_receiver` builds the receiver's `base` only from `property_chain[0]` (the inner
identifier) and never consults an `as_expression` cast target. So a call on an explicitly-cast
receiver — `(x as Concrete).method()` or `(<Concrete>x).method()` — resolves against the inner
identifier's declared (super)type instead of the cast's concrete type, and the method lookup
fails (`name_not_in_scope` / `method_not_on_type`).

The cast target type is statically present in the AST; this is a fixable resolver gap, not a
permanent limitation. Surfaced by TASK-190.30.1's registry audit, which deleted two near-duplicate
suppressor classifiers for this pattern.

### Structural-literal cast variant

A follow-up triage folded in the harder structural-literal variant: `(x as { m?: () => void }).m()`,
where the cast target is an inline anonymous object-type literal rather than a nominal class. There
is no class definition to bind to, so resolution must fall through to the concrete underlying
object's real type. Handle this after the nominal-cast case lands.

### Origin (deleted classifier rows this tracks)

`type-cast-dispatch`, `type-cast-receiver` (near-duplicate; one fix resolves both), and
`dynamic-cast-structural-type-dispatch` (the structural-literal cast target; observed once in angular).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `(x as Concrete).method()` resolves the method against `Concrete`, not against the inner
      identifier's annotated type.
- [x] The `<Concrete>x` cast form is handled equivalently.
- [x] `extract_receiver` consults the `as_expression` / cast target when building the receiver base.
- [x] The structural-literal cast variant `(x as { m(): void }).m()` resolves through the concrete
      underlying object's type (no nominal class to bind to).
- [x] Regression tests cover both cast syntaxes and the structural-literal variant.

<!-- AC:END -->

## Implementation Notes

## High-level summary

A method call on an explicitly-cast receiver — `(x as Concrete).method()`,
`(<Concrete>x).method()` — resolves the method against the cast's concrete type. The
gap lived in the semantic indexer, not the resolver: `extract_property_chain` in
`metadata_extractors.javascript.ts` walked only plain identifiers and member chains, so a
parenthesized cast receiver fell through and the inner receiver was dropped entirely
(`property_chain` collapsed to `["method"]`, resolving to nothing).

The fix teaches the property-chain walk to peel parentheses and casts off a receiver's
object node via `peel_receiver_object`. A nominal cast re-types the whole inner expression,
so the cast target's name is contributed as the chain base (`chain[0]`); downstream
`resolve_identifier_base` already binds a bare type name used as a receiver to its own type,
so the method looks up on `Concrete` with no change to the resolver or any type/wire
contract. Everything without a nominal type to bind to is transparent — plain parentheses, a
`satisfies` check (which preserves the inner expression's real type), and a
structural-literal cast (`{ m(): void }`) — so those fall through to the inner expression's
real type, which is exactly the structural-literal acceptance criterion.

### What changed

- **`nominal_cast_type_name(type_node)`** — returns a cast target's bindable type name:
  `type_identifier` → its text; `generic_type` (`Concrete<T>`) → its erased head `Concrete`;
  a structural literal, a qualified `ns.Concrete`, or a missing node → `undefined`.
- **`peel_receiver_object(node)`** — peels `parenthesized_expression`, `as_expression`,
  `satisfies_expression`, and `type_assertion` (the `<Concrete>x` form). It returns the
  effective inner node plus, for a nominal cast, the `cast_type_name` to use as the base.
- **`extract_property_chain`** — both the member-expression and subscript-expression object
  branches now descend through one `descend_object` closure that consults
  `peel_receiver_object`. A nominal cast pushes the type name as the base slot; otherwise the
  walk continues into the peeled inner expression. As a direct consequence, a plainly
  parenthesized receiver `(x).m()` now resolves too (previously also dropped).

The cast logic is tagged `@language typescript` and lives in the shared `.javascript.ts`
extractor alongside the existing TS-only `extract_typescript_type`, because
`TYPESCRIPT_METADATA_EXTRACTORS.extract_property_chain` delegates directly to the JavaScript
implementation and the cast node types are inert in JavaScript ASTs.

### How the acceptance criteria are covered

- `(x as Concrete).method()` and `<Concrete>x` against the cast target — unit tests on
  `extract_property_chain` (chain base is `Concrete`) plus `Project`-level integration tests
  asserting the call resolves to `Concrete`'s exact method `SymbolId` and that the method is
  therefore not an entry point. A cross-file test covers a cast to an imported class.
- `extract_receiver` consults the cast target — the cast target arrives as `chain[0]`, which
  `extract_receiver` already routes into the receiver base; a `receiver_info` unit test pins
  the full shape (`property_chain` `["Concrete","method"]`, not a self-reference).
- Structural-literal `(x as { m(): void }).m()` — transparent fall-through to the inner
  value's real type; a `Project` integration test resolves it to the concrete class's method.

### Scope boundaries

- `satisfies` is treated as transparent (it validates conformance without re-typing), so
  `(x satisfies Concrete).m()` resolves against `x`'s real type.
- A non-nominal cast target — a structural literal or a qualified `ns.Concrete` — falls
  through to the inner expression's real type rather than binding to the cast; this degrades
  safely (no crash, no mis-resolution).
- Non-null-assertion receivers (`x!.m()`) are a separate, pre-existing gap and are out of
  scope here.
