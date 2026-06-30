---
id: TASK-354
title: Bind `const X = require('./mod')` default-export class for static, instance, and constructor dispatch
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - call-resolution
  - javascript
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

When a CommonJS module's sole export is `module.exports = ClassName`, Ariadne does not bind a
`const X = require('./mod')` import to the class. As a result, every form of dispatch on `X` fails:
static (`X.make()` → `method_not_on_type`), instance, and constructor (`new X()` does not walk back
to the class's constructor member). The destructured form `const { X } = require('./mod')` already
resolves, which isolates the default-export-class binding as the specific gap.

Surfaced by TASK-190.30.1's registry audit, which deleted two suppressor classifiers for this
pattern. Confirmed still-broken in current `packages/core` via a two-file live repro.

### Named-destructure static dispatch (scope correction)

A follow-up investigation found the destructured form is not fully resolved after all: while the
binding resolves for some forms, **static-method dispatch through a named-destructure require still
fails** — `const { BufferedWorkerPool } = require('./buffered-worker-pool'); BufferedWorkerPool.create()`
(mocha `lib/nodejs/buffered-worker-pool.js`, exported as `exports.BufferedWorkerPool = class …`)
does not resolve `create` to the static method. Cover the named-destructure static-dispatch case
alongside the default-export `module.exports = Class` case.

### Origin (deleted/removed classifier rows this tracks)

`static-method-on-cjs-class`, `module-exports-class-constructor`, and the static-on-CJS-class half of
`unresolved-receiver-type` (removed by TASK-190.30.1's follow-up; the whole-namespace half is TASK-361).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `const X = require('./mod')` where `mod` does `module.exports = Class` binds `X` to the class.
- [ ] `X.staticMethod()` resolves to the class's static method.
- [ ] `new X()` resolves to the class's constructor member.
- [ ] `const { X } = require('./mod')` (named export of a class) resolves `X.staticMethod()` to the
      static method.
- [ ] Regression tests cover static, instance, and constructor dispatch through both the default-export
      and the named-destructure require binding.

<!-- AC:END -->
