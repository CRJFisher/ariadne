---
id: TASK-199.18
title: "Fix: TypeScript namespace import method resolution (import * as X)"
status: Done
assignee: []
created_date: "2026-03-30 14:00"
completed_date: "2026-04-01"
labels:
  - enhancement
  - call-resolution
  - typescript
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/
  - packages/core/src/resolve_references/resolve_references.typescript.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`import * as X from './module'; X.func()` does not fully resolve in TypeScript. The call `X.func()` should resolve to the exported `func` in `./module`, but the resolver doesn't follow namespace imports to their target module's exports.

Discovered during task-199.8. The test in `resolve_references.typescript.test.ts` currently has a conditional branch that accepts either resolved or unresolved behavior.

### Actions

1. Trace the resolution path for `X.func()` where `X` is a namespace import — identify where it fails
2. Implement namespace-to-module resolution: when the receiver is a namespace import binding, look up the property name in the target module's exports
3. Update the existing test to assert unconditional resolution
4. Add test cases: nested namespace access (`X.sub.func()`), namespace with re-exports, namespace constructor calls (`new X.MyClass()`)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

Investigation revealed namespace import resolution was already implemented and working end-to-end:

- `receiver_resolution.ts` returns import symbol directly for import-kind definitions
- `method_lookup.ts` has `resolve_namespace_method()` that looks up exports in the source module
- `import_graph.ts` pre-resolves import paths for O(1) lookup during call resolution

The test had a conditional branch accepting either behavior (working or broken), masking that resolution already worked.

### Changes Made

1. **Removed conditional branch** in first test — unconditionally asserts `formatName`/`formatDate` are NOT entry points, plus verifies `process` function's `enclosed_calls` contain both resolved calls
2. **Strengthened constructor test** — asserts `User` class is NOT an entry point (constructor resolved through namespace); documents that `greet()` remains an entry point (no constructor return type inference)
3. **Added barrel file re-export test** — asserts `add`/`multiply` are not entry points (indirect reachability via function references in re-exports), but documents that `calculate` has no enclosed call edges (re-exports create import-kind definitions which `resolve_namespace_method` skips)

### Known Limitations

- **Barrel file re-exports**: `import * as math from "./math"; math.add()` where `math/index.ts` has `export { add } from "./add"` — the call doesn't create a direct edge because `resolve_namespace_method` skips import-kind definitions. Functions are still caught by indirect reachability, so no false positive entry points.
- **Constructor return type inference**: `const x = new Ns.Class(); x.method()` — the method call on `x` doesn't resolve because the resolver doesn't infer variable type from constructor assignments.
