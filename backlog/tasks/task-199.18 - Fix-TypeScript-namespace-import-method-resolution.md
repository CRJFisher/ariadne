---
id: TASK-199.18
title: "Fix: TypeScript namespace import method resolution (import * as X)"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
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
