---
id: TASK-361
title: Bind CommonJS whole-namespace require so `ns.method()` resolves against the module's exports
status: Done
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

## Implementation Notes

### High-level summary

`var ns = require('./mod'); ns.method()` resolves `method` against the module's
CommonJS function exports, so a function reachable only through whole-namespace
dispatch is no longer a false unreachable entry point.

The require→namespace routing was already correct: a whole-namespace `require()`
binding carries `import_kind: "namespace"`, the `ImportGraph` resolves its target
file, and `method_lookup` routes namespace receivers through
`resolve_namespace_export`. The gap was entirely in stage-1 export **indexing** —
a CommonJS property export whose value is a function (`exports.fn = …` /
`module.exports.fn = …`) never produced an exported definition named `fn` for the
resolver to find. The fix closes that gap for every function-valued shape the
target files use.

### What changed

- **Named function expressions** (`exports.castArray = function castArray(){}` —
  the tracked mocha instances `castArray`/`isBrowser`) already produce a
  `@definition.function` named after the function. `build_export_cache`
  (`symbol_factories/exports.javascript.ts`) now registers these, keyed by the
  function name with the property recorded as the public export name.
- **Anonymous function and arrow exports** (`exports.escape = function(){}`,
  `module.exports.uniqueID = () => {}`) previously produced no definition at all.
  A new top-level-anchored `@definition.function.commonjs_export` capture
  (`queries/javascript.scm`) plus `handle_definition_function_commonjs_export`
  (`capture_handlers/capture_handlers.javascript.ts`) creates a function
  definition named after the export property, marked exported directly. Its
  location at the property identifier lets `find_body_scope_for_definition`
  attach the function body — the same geometry as `const NAME = () => {}` — so the
  body's calls stay attributed to the export.

Both `exports.X` and `module.exports.X` bases are covered. `is_exported` is set
directly for the anon/arrow path (never through the name-keyed cache), so a
same-named local is not falsely exported. The capture is anchored to module top
level (`(program (expression_statement …))`), matching the export cache's
top-level-only walk — an `exports.x = () => {}` nested inside a function body is a
local assignment, not a module export.

### How the acceptance criteria are met

- **AC1 / AC4** — `project.javascript.integration.test.ts`, describe "CommonJS
  whole-namespace method dispatch": `var ns = require('./mod'); ns.fn()` resolves
  the method call to the exact export `symbol_id` for named, anonymous, and arrow
  shapes across both `exports.` and `module.exports.` bases.
- **AC2** — the two origin diagnostic shapes ("≥1 call-ref but unresolved" and
  "no-call-ref") were the named-fn-expr and anon/arrow halves of the same
  indexing gap; both resolve once the export is indexed. Both halves are exercised.
- **AC3** — the tests assert each export appears in
  `get_all_referenced_symbols()` (the set entry-point detection consults), and the
  anon/arrow test asserts the body's callees are edges out of the export via the
  call graph, proving attribution rather than incidental reachability.

### Scope boundaries (verified, left as-is)

- Two top-level `exports.foo = fn` assignments sharing an export name, or two
  named function expressions sharing an inner name, hit the ExportRegistry's
  pre-existing "Duplicate export name" throw — identical to the behavior the
  identifier form (`exports.foo = a; exports.foo = b`) already has. Not widened by
  this change; a general last-wins dedup is a separate ExportRegistry concern.
- Generator-function exports (`exports.g = function*(){}`) remain unindexed
  (uncommon; outside the stated scope).
- `build_export_cache` is shared with TypeScript, so a named-function-expression
  CommonJS export in a `.ts` file is now also marked exported — a widening toward
  correctness; TypeScript is otherwise ESM and needs no capture.
