---
id: TASK-199.8.1
title: Fix Rust import module_path including symbol name instead of just module path
status: Done
assignee: []
created_date: "2026-03-29 20:28"
labels:
  - bug
  - rust
  - import-resolution
dependencies: []
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/symbol_factories/imports.rust.ts
  - >-
    packages/core/src/resolve_references/import_resolution/import_resolution.rust.ts
parent_task_id: TASK-199.8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug

In `imports.rust.ts`, `extract_imports_from_use_declaration()` stored the full `use` path (including the symbol name) as the `module_path`. This caused `resolve_module_path_rust()` to try to resolve the entire path as a file path, which always failed for cross-file Rust imports.

**Example:** For `use utils::format_name`:

- Old (broken): `module_path = "utils::format_name"` → resolver tries to find `format_name.rs` inside `utils/`
- New (correct): `module_path = "utils"` → resolver correctly finds `utils.rs`

This bug meant **all cross-file Rust import resolution was broken** — imported functions always appeared as false-positive entry points in the call graph.

## Root Cause

The `module_path` field in `ImportInfo` serves as the file path for the import resolution system. For TypeScript and Python, the import path naturally separates the module path from the symbol name (`import { X } from "./module"`). But Rust's `use` syntax combines them (`use module::X`), and the extraction code was not stripping the symbol name.

## Fix

Added `strip_last_segment()` helper to `imports.rust.ts` that removes the last `::` segment from a path. Applied it to all import extraction cases: `scoped_identifier`, `scoped_use_list`, and `use_as_clause`.

Also fixed `original_name` for aliased imports to contain just the symbol name instead of the full path.

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed in task-199.8. Added `strip_last_segment()` helper and applied it to all Rust import extraction cases. Updated 3 test assertions in `index_single_file.rust.test.ts` to match corrected behavior. Verified by 5 new multi-file Rust integration tests + 207 existing symbol_factories tests + 55 import_resolution tests.

<!-- SECTION:FINAL_SUMMARY:END -->
