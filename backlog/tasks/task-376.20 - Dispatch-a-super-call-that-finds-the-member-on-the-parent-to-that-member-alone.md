---
id: TASK-376.20
title: Dispatch a super call that finds the member on the parent to that member alone
status: To Do
assignee: []
created_date: '2026-09-15 14:00'
labels:
  - method_lookup
dependencies:
  - TASK-376.13
parent_task_id: TASK-376
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wave 6, beside TASK-376.8, TASK-376.14 and TASK-376.15, and ahead of TASK-376.18, which pins the per-corpus counts. Requires TASK-376.13 (the `ReceiverBinding` passed to `resolve_method_on_type`).

## Root cause

`ReceiverBinding` (`call_resolution/method_lookup.ts`) states that a `super` receiver dispatches up the inheritance chain from the parent and never down to the parent's subtypes, which include the calling class. The miss branch honours it: `fans_out` requires `receiver_binding === "value"`. The class-hit branch does not read the binding. `Child.save()` calling `super().save()` where `Parent` declares `save` resolves to `[Parent.save, ...overrides]` over `Parent`'s whole subtype closure: `Child.save` gains an edge from its own body, and every sibling's `save` gains an edge from `Child.save`, so a sibling override nothing else calls is hidden as an entry point. On the miss path the same shape accounted for 2,958 of django's 3,442 candidate edges in TASK-376.13 before its guard. The hit also records `Parent` in `subtype_dispatch_files`, so every change below `Parent` re-answers the calling file.

## Work plan

1. In `resolve_method_on_type`'s class-hit branch, a `"super"` binding returns `[method_symbol]` with `subtype_closure_of: null`; a `"value"` binding keeps `[base, ...overrides]` over the closure. The constructor short-circuit ahead of it is unchanged.
2. Unit tests in `method_lookup.test.ts` beside "never fans a `super` miss out": a `super` hit on a class with overrides returns the parent member alone and names no closure; the same lookup with `"value"` still fans out.
3. Integration tests over Python and TypeScript fixtures (`super().save()` / `super.save()` in an override with a sibling override): the caller reaches `Parent.save` only, the caller's own `save` has no self-edge, and the sibling `save` stays an entry point; a Python `super().m()` whose `m` a grandparent in the project declares resolves to the grandparent member.
4. Measure with `run_load_benchmark.ts --baseline` on angular, rustc, django and pandas against the TASK-376.13 merge (`13ad2d46`), control arm in the same session. Report resolved calls, call edges and raw entry points per corpus; every entry point gained is a self or sibling override the `super` hit reached, spot-checked on django. Re-pin the recorded corpus literals the change moves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A `super` receiver whose method the parent declares or inherits resolves to that member alone and records no subtype closure; a value receiver's class-hit fan-out is unchanged.
- [ ] #2 Unit and integration tests cover the parent-declared hit, the grandparent-declared hit, the absent self-edge and the sibling override remaining an entry point, in Python and TypeScript.
- [ ] #3 Resolved-call, call-edge and raw-entry-point deltas on angular, rustc, django and pandas are measured against `13ad2d46` and recorded, with gained entry points spot-checked on django.
<!-- AC:END -->
