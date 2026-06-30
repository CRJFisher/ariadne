---
id: TASK-361
title: Bind CommonJS whole-namespace require so `ns.method()` resolves against the module's exports
status: To Do
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - call-resolution
  - javascript
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/method_lookup.ts
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A CommonJS whole-namespace import — `var utils = require('./utils')` followed by
`utils.castArray(...)` / `utils.isBrowser()` — does not resolve: the receiver `utils`
binds to a `require()` import but `method_lookup` does not route it to the module's
top-level `exports.X` definitions, so the call is reported unresolved and the target
(`castArray`, `isBrowser`) is falsely flagged unreachable.

This is the JavaScript counterpart of TASK-190.11 (Python `module.func()` namespace
receiver dispatch). `method_lookup.ts` already routes `import_kind === "namespace"`
(`import * as X`) and named/default ES imports to `resolve_namespace_export` /
`resolve_named_import`; the CommonJS `require()` whole-namespace binding falls through
those branches.

Surfaced by TASK-190.30.1's follow-up investigation of the keep-pending wip
classifiers: the `unresolved-receiver-type` and `receiver-type-unknown` suppressors
were removed (deferred-feature classifiers), and the real mocha hit sites proved to
be this CJS-namespace binding gap — not the "untyped-JS value-flow" their stale
descriptions claimed. Confirmed statically recoverable against `node_modules/mocha`
(`lib/utils.js` `exports.castArray` / `exports.isBrowser`, called 7-9 times each).

### Origin (removed classifier rows this tracks)

`unresolved-receiver-type` (builtin, observed_count 6, mocha — the `>=1 call-ref +
callers-in-registry-unresolved` half), `receiver-type-unknown` (builtin, observed_count
1, mocha — the empty-call-ref + `callers-not-in-registry` half). Same fault, split only
by whether a partial call-ref survived.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `const ns = require('./mod'); ns.method()` resolves `method` against the module's
      top-level `exports.method` (or `module.exports.method`) definition.
- [ ] Both the `>=1 call-ref-but-unresolved` and the `no-call-ref` diagnostic shapes
      for this pattern resolve.
- [ ] A namespace function reachable only via CJS-namespace dispatch is no longer an
      unreachable entry point.
- [ ] Regression test covers the `var ns = require('./mod'); ns.fn()` pattern.

<!-- AC:END -->
