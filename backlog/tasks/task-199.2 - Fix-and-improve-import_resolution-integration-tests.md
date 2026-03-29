---
id: TASK-199.2
title: Fix and improve import_resolution integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:13"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - import-resolution
dependencies: []
parent_task_id: TASK-199
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Critical Finding

All 3 language-specific import*resolution test files contain **zero import resolution tests**. They are misplaced body-based scope/indexing tests that test `build_index_single_file`, not `resolve_module_path*\*`.

### TypeScript (`import_resolution.typescript.test.ts`)

- 6 tests, all scope-boundary tests. `resolve_module_path_typescript` is never called.
- ~21 untested features: relative imports, extension probing (.ts/.tsx/.js/.jsx/.mjs), index file resolution, ESM `.js`→`.ts` mapping, bare package imports, absolute vs relative path handling

### JavaScript (`import_resolution.javascript.test.ts`)

- 5 tests, all scope-boundary tests. `resolve_module_path_javascript` is never called.
- Untested: relative imports, 7-candidate extension probing (.js/.mjs/.cjs + index variants), bare imports. Potential bug: `.jsx` in fallback valid_exts but not in probing candidates.

### Rust (`import_resolution.rust.test.ts`)

- 11 tests, all scope-boundary tests. `resolve_module_path_rust` is never called.
- Untested: `crate::`, `super::`, `self::` prefix resolution, external crate fallback, `mod.rs` parent semantics, crate root finding

### Python (`import_resolution.python.test.ts`)

- This is the **only correctly implemented** import resolution test file. It uses `create_file_tree` helper to build mock `FileSystemFolder` structures and tests `resolve_module_path_python` directly.

## Actions

1. Move misplaced scope tests to appropriate scope test files (or leave and add real tests)
2. Write actual import resolution tests for TypeScript, JavaScript, and Rust following the Python test file pattern
3. Use inline `create_file_tree` helpers (no fixtures needed — import resolution is pure path manipulation)
4. Investigate the `.jsx` extension gap in JavaScript resolver
5. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

The existing misplaced scope tests in these files should also be reviewed for weak assertions. When writing the new import resolution tests, all assertions must check exact expected values — resolved paths must be compared with `toEqual(expectedPath)`, not just `toBeDefined()`.

<!-- SECTION:NOTES:END -->
