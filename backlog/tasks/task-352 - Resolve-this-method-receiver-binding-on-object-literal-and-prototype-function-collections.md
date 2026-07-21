---
id: TASK-352
title: Resolve `this.method()` receiver binding on object-literal and prototype function collections
status: Done
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - call-resolution
  - entry-point-detection
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`resolve_keyword_base` resolves a `this`/self receiver only when the call is inside a class
scope. When a method lives on a plain object literal or a prototype-style function collection
(e.g. `app.path = function () { return this.parent.path() }`), there is no enclosing class scope,
so the receiver fails with `no_enclosing_class_scope` and the sibling method gets no inbound edge.

Surfaced by TASK-190.30.1's registry audit, which deleted four suppressor classifiers describing
this gap. Note: three of the four classifiers can no longer fire because a separate change
(`<anonymous>`-node suppression in `detect_entry_points`) hides the false-positive symptom — but a
live repro confirms the underlying `this.method()` call edge is still unresolved. This task fixes
the root cause: bind `this` to the enclosing object-literal / prototype function-collection
property table so the call resolves.

### Origin (deleted classifier rows this tracks)

`this-based-method-dispatch`, `this-object-method-dispatch`, `this-property-method-dispatch`,
`dynamic-method-dispatch`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `this.method()` inside an object-literal method resolves to the sibling object-literal
      property when that property is a function value.
- [x] `this.method()` inside a prototype-style function collection resolves to the collection's
      sibling function property.
- [x] `resolve_keyword_base` no longer returns `no_enclosing_class_scope` for these object-literal /
      prototype receivers.
- [x] Regression tests cover the object-literal and prototype-function-collection cases.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

A `this`/self receiver whose call site has no enclosing class scope binds to the
function collection whose member body encloses the call, so `this.method()`
resolves to the sibling property instead of failing with
`no_enclosing_class_scope`. This closes the call edge for object-literal methods
and prototype/member-assigned functions across JavaScript and TypeScript.

The fix threads through four layers:

- **Collection members carry property names.** A `FunctionCollection` gains
  `named_members`, mapping each property name to its function value —
  `CollectionMember` is a discriminated union of an inline member
  (`symbol_id` + its body `location`) or a named reference (`reference_name`,
  resolved in the collection's defining scope). Object-literal extraction
  (`symbol_factories.javascript.ts`) records a member for every property that
  holds a function value: a shorthand method, a `function`/arrow value, or a
  value identifier.

- **Member/prototype assignments build a collection.** `detect_member_assignment`
  recognizes `app.method = function () {}` and `Fn.prototype.method = () => {}`;
  `handle_assignment_property` accumulates members by holder name, and
  `attach_collection_members` folds them into the holder definition's
  `FunctionCollection` at build time (variables/constants for object holders,
  the `FunctionDefinition` for prototype constructors), merging with any
  collection an object-literal initializer already produced.

- **Collection method lookup resolves by property name.**
  `resolve_collection_method` matches `named_members` by name (last match wins,
  mirroring last-write-wins reassignment), returning the inline member's symbol
  or resolving a named reference in the holder's scope.

- **`this` binds to the enclosing collection.** `find_enclosing_collection`
  selects the collection whose member function most tightly encloses the call
  site (innermost span wins), and `resolve_keyword_base` falls back to it when no
  class scope is found. Selection by innermost member — rather than by the whole
  object-literal span — keeps a call inside a nested, non-collection object
  literal from binding to an outer collection.

The same tree-sitter query additions (`@assignment.property` prototype pattern)
and the shared symbol-factory/capture-handler code cover both JavaScript and
TypeScript; the resolution logic is language-neutral.

### Verification

The full `@ariadnejs/core` suite (3335 tests) and `@ariadnejs/types` suite pass,
with `tsc` and `eslint` clean. New integration tests in
`receiver_resolution.{javascript,typescript}.test.ts` assert each resolved edge
against the target's own source line — an oracle independent of the collection
metadata resolution consults — and cover the object-literal (shorthand,
function-expression, arrow, named-reference), member-assignment, and prototype
forms, plus negative cases: a missing member, a plain function with no
collection, adjacent literals binding to their own holder, last-write-wins
reassignment, and a nested literal that must not bind to an outer collection.

### Known limitations

- **Assigned functions are not call-graph nodes.** `app.method = function () {}`
  resolves `this.method()`/`app.method()` to the assigned function's symbol, but
  that right-hand side is not registered as a definition, so it is not itself a
  call-graph node. Registering every member-assignment right-hand side was
  rejected because it turns unrelated assignments (`el.onclick = fn`,
  `exports.x = fn`) into spurious unreachable entry points. Object-literal
  members remain nodes via the pre-existing anonymous-function captures.
- **Same-name holders in sibling scopes conflate.** Members accumulate by holder
  name within a file, so two same-named local holders in different scopes
  (`function a(){ const app = {}; app.x = fn } function b(){ const app = {}; ... }`)
  attach to the first. Module-level and single-scope holders — the common case —
  resolve correctly.
- **Object literals nested in class methods** bind `this` to the enclosing class,
  which takes precedence over the collection fallback.
- **Arrow-property `this`** is bound to the object as a deliberate call-graph
  over-approximation, even though an arrow's `this` is lexically the enclosing
  scope; this favors reachability over under-reporting a possible edge.
- On merge with TASK-361 (CommonJS property-function exports), the
  `@assignment.property` handling for `exports.*`/`module.exports.*` receivers
  should be reconciled so a single export is not indexed twice.

<!-- SECTION:NOTES:END -->
