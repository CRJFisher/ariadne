---
id: TASK-356
title: >-
  Follow function/class values through import-aliases and local object-property
  aliases on cast/property receivers
status: Done
assignee: []
created_date: '2026-06-30 00:00'
updated_date: '2026-07-21 11:12'
labels:
  - bug
  - call-resolution
  - typescript
dependencies:
  - TASK-353
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A function or class value is not followed through two indirections, leaving the target unreached:

1. **Import alias on a cast receiver.** `import { ViewRef as InternalViewRef }` followed by
   `(viewRef as InternalViewRef<any>).detachFromAppRef()` — the aliased import is not followed back
   to the original class when the receiver is a type-cast. (Depends on TASK-353's cast-target
   propagation to land first.)

2. **Local object-property alias.** `var Utils = Ns.Utils; Utils.prop()` — the parent object's value
   is not propagated into the local alias variable, so the object-literal property function
   expression is unreached.

Surfaced by TASK-190.30.1's registry audit, which deleted two suppressor classifiers for these
patterns. (A third member of the same audit cluster, the stored-callback-via-object-property
destructure shape, is tracked under TASK-190.28.) Both confirmed still-broken via live repro.

### Origin (deleted classifier rows this tracks)

`aliased-import-method-dispatch`, `aliased-object-property-call`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An aliased import (`import { A as B }`) is followed to the original class when the receiver is
      a type-cast, so `(x as B<...>).method()` resolves.
- [x] #2 A local object-property alias (`var A = Ns.A; A.prop()`) propagates the parent object's value
      so the aliased property call resolves.
- [x] #3 Regression tests cover both indirections.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

Call-graph resolution follows a function or class value through two indirections that otherwise drop the edge. An aliased import used as a type-cast receiver — `import { ViewRef as InternalViewRef }` then `(viewRef as InternalViewRef<any>).detachFromAppRef()` — resolves to the original class's method. A local object-property alias — `var Utils = Ns.Utils; Utils.prop()` — resolves to the object-literal property's function.

The cast-receiver indirection comes from TASK-353's index-time cast peeling: the cast target becomes the receiver's chain base, which existing base resolution binds to the imported class. This task adds the regression coverage (with a same-named distractor class proving the binding is exact).

The object-property alias is delivered by making object-literal function collections key-aware. A `FunctionCollection` records `keyed_members` — each property key mapped to an inline function, an identifier reference, or a nested sub-collection — so a member call dispatches to exactly the keyed member instead of matching a function's own name, which is `<anonymous>` for a function-expression value. A static member alias records `collection_source_key`, and collection dispatch follows it one property into the parent's keyed members. A keyed miss returns a resolution failure rather than the keyless union, so a call never fans out to unrelated sibling functions.

Navigation: `keyed_members` / `KeyedCollectionEntry` / `collection_source_key` are defined in `packages/types/src/symbol_definitions.ts`. Extraction — key capture, nesting, and last-wins duplicate-key dedup — lives in `symbol_factories.javascript.ts` (`extract_functions_from_object`, `extract_collection_source_key`); the JS and TS variable handlers both wire `collection_source_key`. Resolution lives under `resolve_references/call_resolution/`: `collection_dispatch.ts` owns the alias follow (`resolve_keyed_alias`) and the shared `resolve_keyed_member` / `entry_callable` primitives, and `method_lookup.ts` reuses them for direct `obj.prop()` dispatch.

Watch: the alias scope is a single static hop (`var A = Ns.A`). A multi-hop namespace alias (`A.B.C`), a direct two-level chain without an alias (`Ns.A.prop()`), and Python/Rust object collections are out of scope — `keyed_members` is JS/TS-only, and those languages fall through to the existing flat-list dispatch. Nested object function values stay out of the flat `stored_functions` / `stored_references` lists by design, which keeps the union path from reaching them; the trade-off is that reading a whole collection does not mark a nested-only function reachable, which is harmless because such values are anonymous and never entry points.

## Implementation details

- `packages/types/src/symbol_definitions.ts`: added `FunctionCollection.keyed_members?`, the `KeyedCollectionEntry` interface (`key` + one of `function_id` / `reference` / `nested`), and `VariableDefinition.collection_source_key?`, all tagged `@language javascript,typescript` and JSON-serialization-safe (plain arrays, no `Map`).
- `symbol_factories.javascript.ts`: `extract_functions_from_object` builds `keyed_members` (nested object values recorded as `nested` only, never flattened into the union lists); `object_property_key` handles identifier and quoted-string keys and skips computed keys; `set_keyed_member` keeps the last occurrence of a duplicate key to match runtime object semantics; new `extract_collection_source_key` returns the aliased property for a plain member-access initializer only.
- Wiring: `capture_handlers.{javascript,typescript}.ts` pass `collection_source_key`; `definition_builder.add_variable` forwards it.
- `collection_dispatch.ts`: `resolve_keyed_alias` follows a static alias one property into the parent collection's keyed members (method call → nested member; direct call → the aliased value), returning a failure on a miss rather than the union; `resolve_keyed_member` / `entry_callable` are the shared keyed-lookup primitives, reused by `method_lookup.ts` `resolve_collection_method` for direct object dispatch.
- Tests: seven integration cases in `project.typescript.integration.test.ts` (AC#2 alias for function-expression and identifier values, keyed precision, absent-key non-fan-out, direct object dispatch, non-function-alias firewall, AC#1 aliased-import-through-cast with distractor), plus unit coverage in `symbol_factories.javascript.test.ts` (keyed_members extraction with exact ids, quoted/computed/duplicate keys, `extract_collection_source_key`) and `collection_dispatch.test.ts` (keyed alias resolves to only the named member; absent key fails without unioning).

AC#1 and AC#2 are satisfied; AC#3 regression tests cover both indirections. Full core suite (3357), types, mcp, hooks, typecheck, and lint are green.
<!-- SECTION:NOTES:END -->
