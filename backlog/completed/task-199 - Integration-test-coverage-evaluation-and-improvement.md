---
id: TASK-199
title: Integration test coverage evaluation and improvement
status: Done
assignee: []
created_date: "2026-03-27 23:13"
updated_date: "2026-04-15 22:43"
labels:
  - testing
  - integration-tests
  - evaluation
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Comprehensive evaluation of integration test coverage across all modules in `packages/core`. 31 opus agents analyzed 50+ integration test files across 13 modules and 4 languages (TypeScript, JavaScript, Python, Rust).

## Key Findings

### Critical Gaps

1. **import_resolution**: All 3 language test files (TS, JS, Rust) contain **zero import resolution tests** — they only have misplaced scope/indexing tests. `resolve_module_path_*` functions are entirely untested.
2. **capture_handlers Python**: 3 tests are **broken** (wrong handler key names `definition.param.*` instead of `definition.parameter.*`), passing vacuously.
3. **symbol_factories**: Across all languages, ~80% of exported functions have only `typeof` smoke tests, not behavioral tests.
4. **query_code_tree**: Only 10 tests total — each language has 2-3 tests checking 1-2 capture names out of hundreds defined in `.scm` files.

### Systemic Patterns

- **Inline code dominates**: ~95% of tests use inline code. This is appropriate for most modules (small AST snippets). Fixtures are used well in `project/*.integration.test.ts`.
- **Weak assertions**: Many tests assert only `toBeDefined()` or `instanceof Map`, passing even when zero data is extracted.
- **Return references untested everywhere**: `@return.*` captures exist in all 4 `.scm` query files but no integration test validates them.
- **`is_exported` flag**: Only tested for Rust capture_handlers; other languages lack export flag validation in integration tests.

### Per-Language Strength (project module)

- **Python**: Strongest — 38+ fixture tests, comprehensive re-export chains, aliased imports, protocols
- **TypeScript**: Strong — 14 fixture + 10 inline tests, good cross-module and polymorphic coverage
- **JavaScript**: Strong — 22 fixture tests, CommonJS + ES6, re-exports, closures
- **Rust**: Weakest — no incremental update tests, no call graph tests, no re-export tests
<!-- SECTION:DESCRIPTION:END -->
