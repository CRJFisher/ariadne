---
id: TASK-199.5.2
title: >-
  Fix process_scopes skipping all module-type scopes including namespace and mod
  (found during task-199.5)
status: Done
assignee: []
created_date: "2026-03-29 20:47"
labels:
  - bug-fix
  - scopes
  - typescript
  - rust
  - testing
dependencies: []
parent_task_id: TASK-199.5
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Bug: All module-type scopes skipped, including namespace and inline mod

**Root cause:** `process_scopes()` in `scopes.ts` had `if (scope_type === "module") continue;` which was intended to skip only the root file-level module scope (manually created above). But `map_capture_to_scope_type` maps BOTH `"module"` AND `"namespace"` entities to scope_type `"module"`, so TypeScript `namespace` declarations and Rust inline `mod` blocks were also skipped. No child module scopes were ever created.

**Impact:** TypeScript namespaces and Rust inline `mod` blocks produced no scopes. Functions and classes inside them were incorrectly assigned to the root module scope instead of the namespace/mod scope.

**Fix:** Moved the module skip check to AFTER boundary extraction. Changed the condition to compare the extracted `scope_location` against the root `file_location` — only skip if they match (meaning it's the root-level module). Also skip bodyless module declarations (Rust `mod other;`) detected by `symbol_location === scope_location`.

**Files changed:**

- `packages/core/src/index_single_file/scopes/scopes.ts` — Refined module skip logic
- `packages/core/src/index_single_file/scopes/boundary_base.ts` — Added `module` case to `CommonScopeBoundaryExtractor`
- `packages/core/src/index_single_file/scopes/extractors/python_scope_boundary_extractor.ts` — Added `module` case
- `packages/core/src/index_single_file/scopes/extractors/rust_scope_boundary_extractor.ts` — Added `source_file` guard
- `packages/core/src/index_single_file/scopes/extractors/typescript_scope_boundary_extractor.ts` — Added `program` guard
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm` — Added `body: (declaration_list)` requirement to `mod_item` scope capture
- `packages/core/src/index_single_file/scopes/boundary_extractor.test.ts` — Updated unsupported type test
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Fixed in worktree-task-199.5 branch. Namespace and inline mod scopes are now correctly created. Integration tests for TS namespace and Rust mod lock in the fix.

<!-- SECTION:FINAL_SUMMARY:END -->
