---
id: TASK-197
title: Upgrade tree-sitter and language grammars to latest versions
status: To Do
assignee: []
created_date: "2026-03-27 09:57"
labels:
  - dependencies
  - tree-sitter
  - infrastructure
dependencies: []
references:
  - packages/core/package.json
  - packages/core/src/index_single_file/query_code_tree/queries/
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The tree-sitter ecosystem in packages/core is pinned at 0.21.x while latest versions are significantly ahead:

- `tree-sitter`: 0.21.1 → 0.25.0
- `tree-sitter-javascript`: 0.21.4 → 0.25.0
- `tree-sitter-python`: 0.21.0 → 0.25.0
- `tree-sitter-rust`: 0.21.0 → 0.24.0
- `tree-sitter-typescript`: 0.21.2 → 0.23.2

The 0.22+ release changed from native Node bindings to WASM-based bindings, which is a significant API migration.

**Investigation needed:**

1. Check whether all 4 grammar packages support the latest `tree-sitter` core version (0.25.0) — the grammars may lag behind
2. Identify API breaking changes between 0.21 and the target version (Parser API, Tree API, Query API)
3. Check if `.scm` query files need syntax updates for newer tree-sitter versions
4. Assess whether the WASM migration affects performance (parsing benchmarks)

**Implementation:**

1. Bump all tree-sitter packages to the highest mutually-compatible version
2. Migrate any API changes (Parser construction, node access patterns, query execution)
3. Update `.scm` query files if query syntax changed
4. Run full test suite + benchmarks to verify correctness and performance

**CI automation (stretch):**
Create a scheduled CI job (GitHub Action) that:

1. Checks latest versions of tree-sitter + all grammar packages
2. Determines the highest mutually-compatible version set
3. Opens a PR bumping versions when all grammars are ready for a new tree-sitter core version
4. Runs the test suite in the PR to validate compatibility
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 All tree-sitter packages upgraded to highest mutually-compatible version
- [ ] #2 All 2144+ existing tests pass with new versions
- [ ] #3 Performance benchmarks show no regression
- [ ] #4 CI job exists that checks for grammar compatibility and opens upgrade PRs
<!-- AC:END -->
