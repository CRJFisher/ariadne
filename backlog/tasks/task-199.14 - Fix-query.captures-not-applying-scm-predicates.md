---
id: TASK-199.14
title: "Fix: query.captures() not applying .scm predicates"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - bugfix
  - query-code-tree
  - correctness
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/query_code_tree.ts
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/python.scm
parent_task_id: TASK-199
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`query.captures()` in tree-sitter does not apply predicates like `#not-eq?`. The `.scm` query files contain predicate guards (e.g., `javascript.scm` line 147, `typescript.scm` line 362, `python.scm` lines 53 and 255), but these are silently ignored at capture time.

This was discovered during task-199.5.1 when constructor scopes were being double-captured. The scope duplication was fixed with a `locations_equal` dedup in `process_scopes()`, but the underlying issue remains: **predicates are not evaluated**, so any capture relying on `#not-eq?`, `#eq?`, or `#match?` for filtering may produce duplicate or incorrect results.

### Impact

- Duplicate definition captures (e.g., `definition.method` for constructors)
- Any `.scm` predicate acting as a filter is dead code — the filtering never happens

### Actions

1. Investigate all `.scm` files for predicate usage — catalogue which predicates exist and what they guard against
2. Determine whether tree-sitter's `query.captures()` API supports predicate filtering or if it requires `query.matches()` instead
3. Implement predicate evaluation (either switch to `matches()` or add post-capture filtering)
4. Add regression tests that verify predicates actually filter captures
5. Remove the `locations_equal` workaround in `process_scopes()` if predicates now handle the constructor dedup case

### Implementation Notes

- The fix in 199.5.1 (`locations_equal` dedup) is a symptom-level fix. This task addresses the root cause.
- Tree-sitter node bindings may require calling `query.matches()` and extracting captures from match results to get predicate filtering. Research the tree-sitter WASM binding API.
<!-- SECTION:DESCRIPTION:END -->
