---
id: TASK-199.7
title: Improve project integration tests (Rust parity)
status: Done
assignee: []
created_date: '2026-03-27 23:14'
updated_date: '2026-03-29 20:43'
labels:
  - testing
  - project
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Findings

Rust has the weakest project-level integration test coverage compared to the other 3 languages.

### Cross-cutting gaps (all languages)

- `Project.save()` and `restore_file()` — zero test coverage
- `initialize()` with `excluded_folders` — untested
- TSX/JSX files — `detect_language()` supports them but no test uses them

### TypeScript gaps

- Re-exports (`export { X } from "./y"`), aliased named imports, default exports/imports
- Enums, type aliases, generic classes/functions — fixture files exist but no integration tests
- Many orphaned fixture files in `tests/fixtures/typescript/code/`

### JavaScript gaps

- Namespace imports (`import * as X`), polymorphic child dispatch (documented as not yet implemented)
- Orphaned fixture files: `basic_class.js`, `dynamic_access.js`, `object_literals.js`, etc.

### Python gaps

- Dataclasses, advanced OOP, classmethods/staticmethods (fixture files exist but unused)
- `__all__` export control

### Rust gaps (most significant)

- **No incremental update tests** (TS/JS/Python all have them)
- **No call graph construction test**
- **No file removal test**
- **No re-export (`pub use`) tests**
- No trait generics/bounds, lifetimes, macros, enum variants/match, async/await
- No multi-file trait implementations

## Actions

1. Add Rust incremental update, call graph, and file removal tests (parity with other languages)
2. Add Rust `pub use` re-export test
3. Wire up orphaned fixture files or clean them up
4. Tests should use fixtures (following existing `project.*.integration.test.ts` pattern)
5. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Weak Assertion Remediation

Some project integration tests have loose assertions:

- Call graph tests that only check edge count but not exact source→target pairs
- Tests that check `definitions.size > 0` without verifying specific definition names
- Incremental update tests that verify "something changed" but not exact before/after state

All new tests must use exact value assertions. Existing tests with weak assertions should be strengthened when touched.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Changes

### New Tests (7 tests added)
- **Incremental Updates** (3 tests): re-resolve after file update, update dependents when imported file changes, handle file removal
- **Call Graph** (3 tests): build call graph with caller-callee relationships, cross-file calls, update after changes
- **Pub Use Re-exports** (1 test): resolve symbols through pub use re-exports

### Strengthened Assertions (all existing tests)
Replaced loose assertions (`toBeGreaterThan(0)`, `if` guards that silently pass) with exact value checks across all existing tests:
- Impl Blocks: exact method name lists instead of `size > 0`
- Basic Resolution: verify every `helper()` call resolves to the same definition
- Module System: exact import names, exact function definitions, verify all 4 imported functions resolve to utils.rs
- Cross-Module Resolution: exact struct/import names, specific method call verification
- Shadowing: verify local helper shadows import, verify process_data resolves to utils.rs
- Builder Pattern: exact method names and impl method verification
- Basic Struct: exact Point and User method lists
- Polymorphic Trait: exact struct names, exact process/get_name method counts

### Production Bug Fixed (TASK-199.7.1)
**Rust `import_path` included item name in module path** — `use utils::{helper}` produced `module_path = "utils::helper"` instead of `"utils"`. This broke:
- Import graph dependency tracking (get_dependents returned empty)
- Cross-file resolution (imports couldn't resolve through to source files)
- Cross-file call graph construction

Fixed in `imports.rust.ts` with comprehensive unit tests. Updated 3 test files that expected the old format.

### Test Coverage: 17 → 24 tests (41% increase), all with strong exact-value assertions
<!-- SECTION:FINAL_SUMMARY:END -->
