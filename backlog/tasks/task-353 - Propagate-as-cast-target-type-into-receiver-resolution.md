---
id: TASK-353
title: Propagate `as`-cast target type into receiver resolution for `(x as Concrete).m()`
status: To Do
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

### Origin (deleted classifier rows this tracks)

`type-cast-dispatch`, `type-cast-receiver` (near-duplicate; one fix resolves both).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `(x as Concrete).method()` resolves the method against `Concrete`, not against the inner
      identifier's annotated type.
- [ ] The `<Concrete>x` cast form is handled equivalently.
- [ ] `extract_receiver` consults the `as_expression` / cast target when building the receiver base.
- [ ] Regression tests cover both cast syntaxes.

<!-- AC:END -->
