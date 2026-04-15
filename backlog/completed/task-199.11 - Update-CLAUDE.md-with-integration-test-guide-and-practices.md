---
id: TASK-199.11
title: Update CLAUDE.md with integration test guide and practices
status: Done
assignee: []
created_date: "2026-03-27 23:15"
updated_date: "2026-04-15 22:43"
labels:
  - testing
  - documentation
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add a section to CLAUDE.md documenting integration test practices for this repo.

## Content to document

### Integration test architecture

- **50+ integration test files** across 13 modules in `packages/core`
- Three pipeline stages tested: per-file indexing (`index_single_file/`), project resolution (`project/` + `resolve_references/`), entry point detection (`trace_call_graph/`)
- 4 supported languages: TypeScript, JavaScript, Python, Rust

### Test patterns in use

1. **`build_index_single_file()` with inline code** — most common; tests capture handlers, metadata extractors, symbol factories, scopes, type preprocessing. Appropriate for single-file AST-level tests.
2. **`Project` + `update_file()` with inline code** — full pipeline tests in project.test.ts, project.integration.test.ts, persistence tests. Good for cross-file resolution.
3. **`Project` + temp directory with real files** — receiver_resolution, resolve_references, load_project tests. Good for filesystem-dependent features.
4. **Fixture files from `tests/fixtures/{lang}/code/`** — `project.{lang}.integration.test.ts` files. Best for realistic multi-file scenarios.

### Fixture practices

- Fixture files live in `tests/fixtures/{language}/code/` organized by feature (modules/, classes/, functions/, etc.)
- Each language's `project.{lang}.integration.test.ts` loads fixtures via `readFileSync`
- Fixture files should represent realistic code patterns, not synthetic constructs
- Inline code is preferred for small, focused tests (1-10 lines); fixtures for multi-file or complex scenarios

### When to use each pattern

- **Inline**: AST-level extraction, single-construct validation, metadata/factory tests
- **Temp dirs**: Cross-file resolution, import resolution, filesystem operations
- **Fixtures**: Project-level integration, realistic code patterns, regression tests

### Assertion guidelines

- Use `toEqual` with typed literal objects (never `toMatchObject`)
- Avoid `toBeDefined()` for value assertions — verify actual extracted values
- For export flag tests, explicitly test both `is_exported: true` and `is_exported: false` cases
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Assertion Guidelines Addition

The CLAUDE.md integration test guide must prominently document the assertion policy:

**Exact value assertions are mandatory.** Every test that extracts a value must assert the exact expected value. Weak assertions that only confirm existence are bugs:

- `toBeDefined()` — NEVER use for value assertions
- `instanceof Map` — NEVER sufficient alone; check actual entries
- `toHaveLength(> 0)` — NEVER; check exact length and contents
- `not.toThrow()` — NEVER sufficient for handler tests; verify output
- `if (node) { expect... }` guards — NEVER; assert the node exists, then check its value

**Always use `toEqual` with typed literal objects** (per existing CLAUDE.md rule: never use `toMatchObject`).

<!-- SECTION:NOTES:END -->
