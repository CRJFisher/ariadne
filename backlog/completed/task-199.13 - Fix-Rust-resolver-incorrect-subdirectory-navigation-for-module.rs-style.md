---
id: TASK-199.13
title: "Fix: Rust resolver incorrect subdirectory navigation for module.rs style"
status: Done
assignee: []
created_date: "2026-03-29 12:55"
labels:
  - bugfix
  - import-resolution
  - rust
dependencies: []
references:
  - >-
    packages/core/src/resolve_references/import_resolution/import_resolution.rust.ts
  - >-
    packages/core/src/resolve_references/import_resolution/import_resolution.rust.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug

The Rust import resolver (`import_resolution.rust.ts`) incorrectly navigated subdirectories when resolving multi-segment module paths using the Rust 2018+ `module.rs` style (as opposed to the older `module/mod.rs` style).

For `crate::module::submod` with file layout:

```
src/
  lib.rs
  module.rs        # Rust 2018+ style
  module/
    submod.rs
```

The resolver would look for `src/submod.rs` instead of `src/module/submod.rs`.

## Root Cause

In `resolve_rust_module_path`, when a non-leaf module part matched `module.rs`, the code used `path.dirname(candidate)` to set the next search directory. For `src/module.rs`, `path.dirname` returns `src/`, but submodules live in `src/module/`.

The `mod.rs` case worked correctly because `path.dirname("src/module/mod.rs")` = `"src/module/"`.

## Fix

Replaced the uniform `path.dirname(candidate)` with style-aware logic:

- For `mod.rs` style: `path.dirname(candidate)` (unchanged, correct)
- For `module.rs` style: `path.join(current_path, part)` (navigates into the module directory)

## Tests

4 tests lock in this fix:

- `resolves crate::module::submod with module.rs style (Rust 2018+)`
- `resolves deeply nested crate path with module.rs style`
- `resolves mixed module.rs and mod.rs styles`
- `resolves deeply nested crate path with mod.rs style` (regression guard)
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed subdirectory navigation in Rust resolver for module.rs style (Rust 2018+). Added style-aware directory resolution that distinguishes module.rs from mod.rs patterns. 4 tests lock in the fix.

<!-- SECTION:FINAL_SUMMARY:END -->
