---
id: TASK-199.5
title: Improve scopes integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:14"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - scopes
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

### TypeScript (9 integration tests)

- Covered: class/interface/enum body-based scoping, named function expressions, nested functions
- 12 gaps: abstract class, class expression, namespace, generator functions, arrow function, interface method signatures as scopes, constructor scope, all block scope types, nested classes, static methods, access-modified methods

### JavaScript (9 integration tests)

- Covered: class declaration/expression, named/anonymous function expressions, nested functions
- 18 gaps: generator functions, arrow function (standalone), expression body arrows, all block scopes (for/while/if/switch/try/catch/finally), constructor, nested classes, deeply nested scopes

### Python (26 tests across 3 files — best covered)

- Covered: class boundaries (inheritance, decorated, nested, single-line), function/method boundaries, constructor delegation, basic blocks
- Key gaps: lambda via `extract_lambda_boundaries` (dead code path), block node path in `extract_class_boundaries`, comprehension scopes (4 captures, 0 tests), match/case scopes, elif/else/finally/with blocks, decorated methods inside classes

### Rust (11 tests across 2 files)

- Covered: struct/enum/trait/impl body-based scoping, nested functions, tuple struct edge case
- **Key gaps**: closure scopes (zero tests, pervasive in Rust), all 8 control flow block scopes (if/match/for/while/loop/unsafe/async + match_arm — zero tests), `mod` module scopes (both inline and external), trait with default method hierarchy, impl with multiple methods sibling hierarchy

## Actions

1. Add block scope integration tests for JS and TS (for/while/if/try/catch/switch)
2. Add Rust closure scope test (highest Rust-specific priority)
3. Add Rust control flow block scope tests (if/match/for/while/loop, unsafe/async blocks)
4. Add Rust `mod` module scope test (inline and external)
5. Add constructor scope tests for JS and TS
6. Add comprehension and match/case scope tests for Python
7. Add namespace scope test for TS
8. Investigate Python lambda scope `extract_lambda_boundaries` — appears to be dead code
9. All tests should remain inline
10. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

Some scope tests use loose assertions that should be tightened:

- Verify exact `scope_location.start_line`/`start_column` values, not just `> 0`
- Verify exact `defining_scope_id` values match expected parent scope IDs
- Verify exact depth values, not just relative ordering
- The Rust DEBUG test (#6) only checks `scopes > 0` — replace with exact count and type assertions
<!-- SECTION:NOTES:END -->
