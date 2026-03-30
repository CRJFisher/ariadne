---
id: TASK-199.7.1
title: Fix Rust import_path including item name in module path
status: Done
assignee: []
created_date: "2026-03-29 20:41"
labels:
  - bug
  - rust
  - import-resolution
dependencies: []
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/symbol_factories/imports.rust.ts
parent_task_id: TASK-199.7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug

In `imports.rust.ts`, the `extract_imports_from_use_declaration` function incorrectly included the item name in the `module_path` for Rust `use` declarations. For `use utils::{helper, process_data}`, the `module_path` was set to `"utils::helper"` instead of `"utils"`.

This caused:

1. **Import graph dependency tracking failure** — `resolve_module_path_rust("utils::helper")` tried to find `helper.rs` as a submodule instead of recognizing `helper` as a symbol in `utils.rs`. The fallback returned a literal string, breaking the dependency graph.
2. **Cross-file resolution failure** — `project.get_dependents(utils_file)` returned empty sets for Rust files, preventing incremental re-resolution.
3. **Cross-file call graph gaps** — The call graph couldn't track cross-file calls in Rust because imports didn't resolve to their source files.

## Root Cause

In `imports.rust.ts`, the `scoped_use_list` case (line ~146) was computing `full_path = \`${prefix}::${item.text}\``and using that as the`module_path`. The `scoped_identifier` top-level case had the same issue.

## Fix

Changed all cases in `extract_imports_from_use_declaration` to correctly separate the module path from the item name:

- `scoped_use_list` identifiers: `module_path = prefix` (not `prefix::item`)
- `scoped_identifier`: extract path from the path node (not the full text including the name)
- `use_as_clause` variants: same separation

Also updated 3 test files that expected the old (buggy) import_path format.

<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed Rust `module_path` extraction to correctly separate module path from item name in all `use` declaration patterns. The fix enables proper import graph dependency tracking, cross-file resolution, and cross-file call graph construction for Rust. Updated 3 test files and added comprehensive unit tests for the import extraction function.

<!-- SECTION:FINAL_SUMMARY:END -->
