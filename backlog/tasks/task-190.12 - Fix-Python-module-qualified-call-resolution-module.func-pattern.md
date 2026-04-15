---
id: TASK-190.12
title: Fix Python module-qualified call resolution (module.func() pattern)
status: To Do
assignee: []
created_date: "2026-03-28 14:40"
labels:
  - bug
  - resolve-references
  - auto-generated
  - python
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/receiver_resolution.ts
  - >-
    packages/core/src/resolve_references/import_resolution/import_resolution.python.ts
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Description

Ariadne fails to resolve calls made via module-qualified syntax (`module.func()`) in Python. When code does `from projections.runtime import check_gpu; check_gpu.reset_peak_gpu_memory()`, Ariadne treats `check_gpu` as a class instance and tries class method lookup, which fails. The function has real callers but appears as an unreachable entry point.

## Reproduction

```
File: runtime/check_gpu.py
Function: reset_peak_gpu_memory (line 41)
Expected: Not reported as entry point (called via check_gpu.reset_peak_gpu_memory())
Actual: Reported as unreachable entry point
```

Also affects: `get_peak_gpu_memory_gb` (check_gpu.py:46) — same pattern.

## Root Cause

- **Pipeline stage**: `resolve_references` (call_resolution)
- **Module**: `packages/core/src/resolve_references/call_resolution/receiver_resolution.ts`
- **Code path**: `resolve_receiver_type()` resolves `check_gpu` to an import but doesn't recognize it as a module/namespace import. The method call `check_gpu.reset_peak_gpu_memory()` fails because there's no class to look up the method on. TS already handles this for `import * as mod` via `resolve_namespace_method()` — Python module imports need the same routing.

## Fix Approach

1. **`receiver_resolution.ts`**: When a method call receiver resolves to an import with `import_kind: "namespace"`, route to `resolve_namespace_method()` — same path as TS namespace imports.

2. **`import_resolution.python.ts`**: Verify that `from package import module` creates a namespace import (not a named import). If not, fix the import classification.

3. **Test**: Add fixture with Python `from package import module; module.func()` pattern.

## Review Notes

- **info-architecture**: Fix extends existing `resolve_namespace_method()` — consistent with TS handling.
- **simplicity**: Minimal change — routing branch in receiver resolution.
- **fundamentality**: Fixes root cause in call resolution.
- **language-coverage**: Extends existing TS namespace handling to Python. Cross-language consistency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Python module.func() calls resolve correctly when module is imported via 'from package import module'
- [ ] #2 Python module.func() calls resolve correctly when module is imported via 'import module'
- [ ] #3 Test fixture added for Python module-qualified call pattern
- [ ] #4 No regression in existing test suite
- [ ] #5 TS namespace import resolution still works correctly
<!-- AC:END -->
