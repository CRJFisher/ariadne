---
id: TASK-352
title: Resolve `this.method()` receiver binding on object-literal and prototype function collections
status: To Do
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

- [ ] `this.method()` inside an object-literal method resolves to the sibling object-literal
      property when that property is a function value.
- [ ] `this.method()` inside a prototype-style function collection resolves to the collection's
      sibling function property.
- [ ] `resolve_keyword_base` no longer returns `no_enclosing_class_scope` for these object-literal /
      prototype receivers.
- [ ] Regression tests cover the object-literal and prototype-function-collection cases.

<!-- AC:END -->
