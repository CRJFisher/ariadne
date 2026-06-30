---
id: TASK-356
title: Follow function/class values through import-aliases and local object-property aliases on cast/property receivers
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
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

- [ ] An aliased import (`import { A as B }`) is followed to the original class when the receiver is
      a type-cast, so `(x as B<...>).method()` resolves.
- [ ] A local object-property alias (`var A = Ns.A; A.prop()`) propagates the parent object's value
      so the aliased property call resolves.
- [ ] Regression tests cover both indirections.

<!-- AC:END -->
