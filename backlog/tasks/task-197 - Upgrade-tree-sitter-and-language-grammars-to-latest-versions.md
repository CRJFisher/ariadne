---
id: TASK-197
title: Upgrade tree-sitter and language grammars to latest versions
status: Done
assignee: []
created_date: '2026-03-27 09:57'
updated_date: '2026-03-30 14:56'
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
- [x] #1 All tree-sitter packages upgraded to highest mutually-compatible version
- [x] #2 All 2144+ existing tests pass with new versions
- [ ] #3 Performance benchmarks show no regression
- [ ] #4 CI job exists that checks for grammar compatibility and opens upgrade PRs
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Upgraded all tree-sitter packages to highest mutually-compatible versions:

| Package | Before | After |
|---|---|---|
| tree-sitter | 0.21.1 | 0.25.0 |
| tree-sitter-javascript | 0.21.4 | 0.25.0 |
| tree-sitter-python | 0.21.0 | 0.25.0 |
| tree-sitter-rust | 0.21.0 | 0.24.0 |
| tree-sitter-typescript | 0.21.2 | 0.23.2 |

### Breaking changes addressed

1. **Rust grammar: `constrained_type_parameter` removed** — merged into `type_parameter` with `name`/`bounds` fields. Updated `rust.scm` query and `extract_generic_parameters()` in `symbol_factories.rust.ts`.

2. **Grammar package type definitions inaccurate** — JS/Python grammars missing `name` property, all grammars use `language: unknown` instead of `Language`. Added `tree_sitter_grammars.d.ts` with correct module declarations.

3. **No prebuilt binaries** — `tree-sitter@0.25.0` requires `node-gyp` to compile from source (0.21.x shipped prebuilts). Added `node-gyp` as a global dev dependency.

### Investigation findings

- **No WASM migration needed** — native Node.js bindings remain actively maintained alongside `web-tree-sitter`
- **No `.scm` query syntax changes** — only node type renames in Rust grammar
- **JavaScript, Python, TypeScript queries** — all compatible with new grammar versions without changes

### Files changed

- `packages/core/package.json` — version bumps
- `packages/core/src/tree_sitter_grammars.d.ts` — new type overrides
- `packages/core/src/index_single_file/query_code_tree/queries/rust.scm` — `constrained_type_parameter` → `type_parameter`
- `packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.rust.ts` — updated `extract_generic_parameters()`
- `.gitignore` — exception for hand-written `.d.ts`
- `pnpm-lock.yaml`

### Not implemented

- AC#3 (benchmarks): No benchmark suite exists yet to measure regression
- AC#4 (CI automation): Stretch goal, deferred
<!-- SECTION:FINAL_SUMMARY:END -->
