---
id: TASK-199.10
title: Improve query_code_tree and extract_nested_definitions tests
status: Done
assignee: []
created_date: "2026-03-27 23:15"
updated_date: "2026-04-01 21:33"
labels:
  - testing
  - query-code-tree
dependencies: []
parent_task_id: TASK-199
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## query_code_tree findings

`query_loader.test.ts` is well covered (60 tests). `query_code_tree.test.ts` is severely under-covered:

- Only 10 tests total across all languages
- Each language has 2-3 tests checking 1-2 capture names
- No tests for scope captures, reference captures, import/export captures, modifier/decorator captures, assignment/return captures
- These captures drive the entire pipeline — a regression here silently breaks everything downstream

## extract_nested_definitions findings (17 tests)

TypeScript has 8 tests (best), Python/JavaScript/Rust have 3 each.

- Cross-language gaps: type annotation extraction (only TS), default values (only TS), empty result case (only TS), `symbol_id`/`location` validation (no language)
- Python-specific: `*args`/`**kwargs`, keyword-only params, Protocol methods
- Rust-specific: `&mut self`, owned `self`, generic parameters, pattern parameters

## Actions

1. Add comprehensive capture-name tests to `query_code_tree.test.ts` per language (use fixture files with realistic multi-construct source code)
2. Add missing per-language parameter extraction tests to extract_nested_definitions
3. Lower priority than other sub-tasks — these are "belt and suspenders" tests since individual handler/factory tests cover the same code paths
4. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

The 10 existing `query_code_tree.test.ts` tests only check that captures array is non-empty and that a specific capture name appears somewhere. New tests must verify exact capture name sets for each language construct — e.g., parsing a `class Foo extends Bar { method() {} }` should produce exactly `["definition.class", "scope.class", "definition.method", "scope.method", ...]`.

extract_nested_definitions: verify exact parameter names, types, and default values — not just count or `toBeDefined()`.

<!-- SECTION:NOTES:END -->
