---
id: TASK-190.11
title: Fix Python module import calls not resolved via namespace receiver
status: To Do
assignee: []
created_date: '2026-03-28 14:38'
labels: []
dependencies: []
parent_task_id: TASK-190
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Description

Functions called via the `module.func()` pattern in Python are falsely reported as unreachable entry points. When a module is imported with `from package import module` and then called as `module.reset_peak_gpu_memory()`, Ariadne treats `module` as a class instance and attempts method lookup on a class. Because `module` is a Python module (not a class), the method lookup fails and the function appears unresolved.

Two entries are affected: `reset_peak_gpu_memory` and `get_peak_gpu_memory_gb` in `check_gpu.py`, both called via `check_gpu.func()` after `from projections.runtime import check_gpu`.

## Reproduction

File: projections/runtime/check_gpu.py
Function: reset_peak_gpu_memory (called via check_gpu.reset_peak_gpu_memory())
Expected: Not reported as entry point (called via module attribute access)
Actual: Reported as unreachable entry point

```python
from projections.runtime import check_gpu

# caller.py
check_gpu.reset_peak_gpu_memory()
check_gpu.get_peak_gpu_memory_gb()
```

## Root Cause

- **Pipeline stage**: `resolve_references` (call_resolution)
- **Module**: `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts`
- **Code path**: `resolve_receiver_type()` does not recognise Python module imports as namespace receivers. When the receiver `check_gpu` resolves to a module import, the resolution path falls through to class instance method lookup, which finds nothing. TypeScript `import * as mod` patterns are already handled by `resolve_namespace_method()` — Python module imports are not routed there.

## Fix Approach

1. **Verify import classification**: Confirm that `from projections.runtime import check_gpu` produces an import record with `import_kind: "namespace"` (or equivalent) in `packages/core/src/resolve_references/import_resolution/import_resolution.python.ts`. If it produces a named import instead, update the classification so module-level imports are tagged as namespace imports.

2. **Extend receiver resolution**: In `receiver_resolution.ts`, inside `resolve_receiver_type()`, add a branch: when the receiver resolves to a Python import whose target is a module (not a class/function), route to `resolve_namespace_method()` — the same path already used for TS namespace imports.

3. **Test fixture**: Add a Python test fixture covering `from package import module; module.func()` call resolution in the existing `receiver_resolution` test file.

## Review Notes

- **info-architecture**: Fix location in `receiver_resolution.ts` is correct. Use the term "namespace" consistently — the codebase already uses it for the TS equivalent.
- **simplicity**: Extending existing `resolve_namespace_method()` is minimal — no new abstractions needed.
- **fundamentality**: Addresses root cause for all Python `module.func()` patterns. Must investigate import classification (named vs namespace) before implementation.
- **language-coverage**: TS already handles `import * as mod; mod.func()` — this brings Python to parity. The namespace receiver concept is transferable to other languages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 check_gpu.reset_peak_gpu_memory() and check_gpu.get_peak_gpu_memory_gb() are resolved as calls rather than reported as entry points,Python from-import of a module produces a namespace import record in import_resolution.python.ts,resolve_receiver_type() routes Python module imports to resolve_namespace_method() in receiver_resolution.ts,Test fixture added for Python module.func() call pattern in receiver_resolution test file,No regression in existing test suite
<!-- AC:END -->
