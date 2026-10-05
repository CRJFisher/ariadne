---
id: TASK-374.6
title: "Resolve receivers in constructor bodies, field initializers, and inferred field types"
status: To Do
assignee: []
created_date: "2026-08-11 08:00"
labels:
  - receiver_typing
dependencies: []
parent_task_id: TASK-374
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Receiver typing leaves four gaps that TASK-374.2 scoped out rather than fixing:

1. **Constructor bodies** — `this`-rooted chains do not resolve from
   constructor scopes at all (ordinary method calls fail there too, not just
   the widened reads). Pinned by "leaves this-receiver resolution unavailable
   in constructor bodies" (`project.typescript.integration.test.ts`).
2. **Field-initializer scopes** — a getter read in a class-field initializer
   position mints its reference but `this` typing does not cover that scope.
3. **Initializer-inferred field types** — `private helper = new Helper()`
   types the field only when a declared annotation is present; inference from
   the constructor-call initializer is missing. Pinned by "leaves a chained
   getter unresolved when the intermediate field type is only inferable from
   its initializer".
4. **Bare-property-name reachability collisions** — the identifier-pinned
   `@reference.property` capture falls back to a lexical variable read, so
   reading any property whose name collides with a top-level function marks
   that unrelated function reachable. Resolving the property-name read
   against the receiver type instead of lexical scope removes the collision.

The prototype-object member family (`this.<method>()` on a CommonJS
module-level object — express `sendFile`/`append`/`location`, webpack
`unpack`) belongs to the same receiver-typing surface and is recorded in
TASK-374.1's re-routes.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A `this`-rooted chain in a constructor body resolves like one in a method body, asserted with a negative control.
- [ ] #2 A getter read in a class-field initializer resolves.
- [ ] #3 A field typed only by its `new X()` initializer participates in receiver typing.
- [ ] #4 A property read never marks an unrelated same-named top-level function reachable.

<!-- AC:END -->
