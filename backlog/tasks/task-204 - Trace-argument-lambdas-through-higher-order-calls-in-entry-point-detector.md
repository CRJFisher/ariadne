---
id: TASK-204
title: Trace argument lambdas through higher-order calls in entry-point detector
status: To Do
assignee: []
created_date: "2026-04-17 22:46"
labels:
  - ariadne-core
  - false-positives
  - call-graph
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

Ariadne's entry-point detector flags inline arrow callbacks passed as arguments to higher-order calls as unreached entry points, producing false positives. The detector treats them as exported callables with zero incoming call edges because it does not follow the lambda through the higher-order callee that invokes it synchronously.

## Observed false positives (current `main` of `feat/self-healing-pipeline-debug`)

7 sites in `packages/core`, all whitelisted under `~/.ariadne/self-repair-pipeline/known_entrypoints/core.json` source `known-false-positives`:

- `packages/core/src/index_single_file/definitions/definitions.ts:201` — `(state, id) => {…}` passed to `Map.forEach` on `this.functions`
- `packages/core/src/index_single_file/definitions/definitions.ts:204` — same pattern on `this.classes`
- `packages/core/src/index_single_file/definitions/definitions.ts:207` — same pattern on `this.interfaces`
- `packages/core/src/index_single_file/definitions/definitions.ts:210` — same pattern on `this.enums`
- `packages/core/src/index_single_file/definitions/definitions.ts:213` — same pattern on `this.namespaces`
- `packages/core/src/project/project.ts:372` — `(import_id) => this.imports.get_resolved_import_path(import_id)` passed as a function-typed argument to `this.types.update_file(...)`
- `packages/core/src/project/project.ts:452` — same resolver-callback pattern, second call site of `this.types.update_file(...)`

Two distinct higher-order shapes are involved:

1. **Built-in iterator method on a known type** (`Map<K,V>.forEach`): the detector knows the receiver type (`Map`) and the well-typed signature of `forEach`, so the callback parameter is provably invoked.
2. **Function-typed parameter on a user-defined method** (`update_file(..., resolver: (id) => Path)`): the detector can see the parameter type from the method signature; any call to that parameter inside the callee body proves invocation.

## Expected behaviour

When a function expression / arrow function is passed as a call argument:

- Resolve the callee (built-in or user-defined).
- Look up the corresponding parameter slot in the callee.
- If the callee invokes that parameter (directly or indirectly), record a synthetic call edge from the callee to the lambda. This makes the lambda reachable and prevents it from surfacing as an entry point.

For built-ins (`Map.forEach`, `Array.forEach`, `Array.map`, `Array.filter`, `Array.reduce`, `Promise.then`, etc.), the invocation is statically known and the edge can be added without analysing the body.

## Acceptance criteria

- [ ] Inline arrow callbacks passed to `Map<K,V>.forEach` / `Array.forEach` / `Array.map` / `Array.filter` / `Array.reduce` / `Promise.then` are not reported as entry points.
- [ ] Inline arrow callbacks passed as function-typed arguments to user-defined functions/methods are not reported as entry points when the callee invokes that parameter.
- [ ] Existing entry-point detection still flags genuine unreached exported callables.
- [ ] Once fixed, remove the `known-false-positives` source from `~/.ariadne/self-repair-pipeline/known_entrypoints/core.json`. Verify the Stop hook passes against the 7 sites listed above without that whitelist entry.

## Out of scope

- Async callbacks stored to fields and invoked later (event handlers, deferred resolvers). These need separate analysis.
- Callbacks passed across file/module boundaries through generic plumbing.

## References

- Detection hook: `.claude/hooks/entrypoint_stop.ts`
- Whitelist file: `~/.ariadne/self-repair-pipeline/known_entrypoints/core.json` (source `known-false-positives`)
- Related call-resolution code: `packages/core/src/resolve_references/call_resolution/`
<!-- SECTION:DESCRIPTION:END -->
