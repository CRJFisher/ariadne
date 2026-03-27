---
id: TASK-199.8
title: Improve resolve_references and receiver_resolution tests
status: To Do
assignee: []
created_date: "2026-03-27 23:15"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - resolve-references
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

### Multi-file integration gaps

- **JavaScript and Rust have zero multi-file integration tests** for resolve_references. All their tests are single-file self-reference tests.
- TypeScript: 6 multi-file re-export tests + 11 self-reference tests (strongest)
- Python: 4 multi-file submodule tests + 10 self-reference tests

### Cross-language untested features

- **Namespace import resolution** (`import * as X`) — no integration test for any language
- **Cross-file constructor calls** — untested for all languages
- **Interface/trait polymorphic resolution** — no integration test (only unit tested)
- **Collection dispatch** — no integration test for any language
- **Callback invocations** (`resolve_callback_invocations`) — never exercised in integration tests
- **Indirect reachability** — no integration test for any language

### receiver_resolution per language

- TypeScript: 11 tests, well covered (this, super, polymorphic, multi-level inheritance)
- Python: 10 tests, well covered (self, cls, super, property chains)
- JavaScript: 3 tests only (this in ES6, prototype, polymorphic partial)
- Rust: 2 tests only (self.method, borrow patterns)

## Actions

1. Add multi-file JavaScript and Rust integration tests (highest priority — cross-file resolution is the core purpose)
2. Add namespace import resolution integration test (at least for TypeScript)
3. Expand Rust receiver_resolution: cross-file modules, trait method resolution, property chains
4. Expand JavaScript receiver_resolution: super calls, property chains
5. Tests should use temp directories with real files (following existing pattern)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

Receiver resolution tests should verify exact `referenced_symbols` entries (symbol_id, resolution kind) rather than just checking array length or `toBeDefined()`. New multi-file tests must assert exact resolved definition symbol_ids, not just that resolution occurred.

<!-- SECTION:NOTES:END -->
