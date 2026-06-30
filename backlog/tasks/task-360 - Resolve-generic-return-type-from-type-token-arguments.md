---
id: TASK-360
title: Resolve generic return type from type-token arguments (`injector.get(Token).m()`)
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

- [ ] `injector.get(Token).method()` resolves `method` against the class the token
      resolves to (generic return type inferred from the `Type<T>` argument).
- [ ] The general shape — a method whose return type is a generic parameter bound
      by a type-token argument — propagates that type into chained-receiver resolution.
- [ ] Regression test covers the `injector.get(Token).method()` chain.

<!-- AC:END -->
