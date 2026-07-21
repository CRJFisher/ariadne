---
id: TASK-354
title: Bind `const X = require('./mod')` default-export class for static, instance, and constructor dispatch
status: Done
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

- [x] `const X = require('./mod')` where `mod` does `module.exports = Class` binds `X` to the class.
- [x] `X.staticMethod()` resolves to the class's static method.
- [x] `new X()` resolves to the class's constructor member.
- [x] `const { X } = require('./mod')` (named export of a class) resolves `X.staticMethod()` to the
      static method.
- [x] Regression tests cover static, instance, and constructor dispatch through both the default-export
      and the named-destructure require binding.

<!-- AC:END -->

## Implementation Notes

## High-level summary

A CommonJS module whose sole export is a class binds its `require` consumers to that class, so
static, instance, and constructor dispatch all resolve through the ordinary class machinery.
Two module shapes are covered: the default export `module.exports = Class` consumed as
`const X = require('./mod')`, and the named class export `exports.X = class X {}` consumed as
`const { X } = require('./mod')`.

The fix spans two pipeline stages. Indexing recognizes the export shapes that were previously
invisible: a named class *expression* assigned to a CommonJS export target becomes a class
definition (with its static methods, instance methods, and constructor), `module.exports =
<identifier>` registers its target as the file's default export, and `exports.X = class X {}`
registers a named export. Name resolution then rebinds a whole-module `require` to its module's
sole default class — but only when the module has no other exports (an object module
`module.exports = { a, b }` stays a namespace import) and only for `require` bindings (an ESM
`import * as X` namespace object is never rebound). Once `X` resolves to the class symbol, the
existing receiver-resolution, method-lookup, and constructor paths handle every dispatch form,
and `new X()` types its variable to the class so instance-method calls resolve too. The named
destructure form needs no resolution change: registering the named export lets the existing
named-import binding resolve `X` directly to the class.

### What changed

- **`index_single_file/query_code_tree/queries/javascript.scm`** — captures a named class
  expression as a definition when it is assigned onto an `exports` / `module` base
  (`module.exports = class X {}`, `exports.X = class X {}`). The capture is anchored to a
  CommonJS export target so a non-export class expression (`const C = class Bar {}`,
  `obj.prop = class Bar {}`) never registers a stray definition whose inner name would shadow a
  sibling binding.
- **`index_single_file/query_code_tree/symbol_factories/exports.javascript.ts`** —
  `build_export_cache` marks `module.exports = <identifier>` and `module.exports = class Named {}`
  as the file's default export (`{ is_default: true }`, last-write-wins across repeated
  `module.exports =`), and `exports.X = class Named {}` as a named export keyed by the class's own
  name.
- **`resolve_references/registries/export.ts`** — `resolve_sole_default_export` returns the
  module's default export only when the file has no named exports, so a `const X = require()`
  binding stays a namespace import for object/multi-export modules.
- **`resolve_references/name_resolution.ts`** — the namespace-import branch rebinds a
  `require` binding to its module's sole default class. The rebind is gated on a new
  `ImportDefinition.is_commonjs_require` flag (set by both `require` capture handlers) so an ESM
  `import * as X` is never rebound, and rebound names are tracked so the local-definition pass
  does not revert the binding to the raw import symbol.
- **`packages/types/src/symbol_definitions.ts`** — adds the optional
  `ImportDefinition.is_commonjs_require` flag that separates a `require()` namespace binding from
  an ESM `import * as` namespace binding (both otherwise carry `import_kind: "namespace"`).

### Acceptance criteria

Each criterion is proven by a test in `project/project.javascript.integration.test.ts`
(`CommonJS Class Export Dispatch`), backed by unit tests for the export shapes
(`exports.javascript.test.ts`, `export.test.ts`) and the class-expression capture
(`capture_handlers.javascript.test.ts`): default-export static/instance/constructor dispatch,
named-destructure static/instance/constructor dispatch, direct binding assertions, the
object-module no-rebind guard, the ESM `import * as` no-rebind guard, and the function-default
no-rebind guard.

### Known limitations

These CommonJS shapes remain unresolved. Each fails cleanly (no dispatch edge) rather than
producing a wrong edge, and none is a stated acceptance criterion:

- **Const-bound default class** — `const Widget = class Widget {}; module.exports = Widget`. The
  intermediate `const` registers as a named export, which suppresses the sole-default rebind. The
  canonical spellings (`class Widget {}` declaration, `module.exports = class Widget {}`) resolve.
- **Anonymous class export** — `module.exports = class {}` / `exports.X = class {}`. An anonymous
  class expression has no name to identify, so it is not captured and its method bodies are
  invisible to reachability.
- **Lazy function-local require** — `function f() { const X = require('./mod'); return new X(); }`.
  The rebind covers top-level requires; a require inside a function body is reverted by the
  function scope's local `const X`.
- **Re-export of a required default** — `const W = require('./w'); module.exports = W`. The default
  entry points at the import symbol and the re-export chain is not followed.
- **ESM `export default` + CommonJS `module.exports =` in one file** — this malformed mix produces
  two default exports and trips the registry's duplicate-default guard.
