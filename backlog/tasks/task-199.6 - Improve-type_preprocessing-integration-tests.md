---
id: TASK-199.6
title: Improve type_preprocessing integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:14"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - type-preprocessing
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

### TypeScript (25+ tests)

- Key gaps: variable type annotation (`const x: number`), standalone function return type, constructor parameter types, enum extraction (only tested via Rust), intersection types, function type aliases, getter/setter, abstract class members

### JavaScript (17 tests: 7 positive, 10 negative)

- JS correctly has mostly negative tests (no type system). Gaps: JSDoc `@type` flowing to bindings, static methods in member extraction, getter/setter, `extends` extraction verification (test comment says it doesn't work but source attempts it)

### Python (15 tests)

- Key gaps: weak assertions in alias and bindings (`toBeDefined()` only), Python 3.12 `type` statement, union/generic type aliases, Protocol member extraction, Enum member extraction, `@classmethod`, multiple inheritance, walrus operator constructor
- No test validates that extracted type values are correct strings

### Rust (16 tests)

- Key gaps: associated type aliases in traits, `Type::new()` construction (idiomatic Rust pattern untested), trait method extraction, struct field/property extraction, function/method return types, weak assertions in 6 of 16 tests

## Actions

1. Strengthen weak assertions across Python and Rust (verify actual extracted values, not just `toBeDefined()`)
2. Add TypeScript enum extraction test (currently only Rust covers enums)
3. Add Python Protocol and Enum member extraction tests
4. Add Rust `Type::new()` associated function construction test
5. Add Python 3.12 `type` statement test
6. All tests should remain inline
7. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation (CRITICAL for this module)

This module has the most pervasive weak assertion problem:

### Python alias.test.ts

- 2 of 3 tests assert only `expect(metadata).toBeDefined()` — must verify exact `type_expression` strings (e.g., `"str"`, `"list[float]"`)

### Python bindings.test.ts

- 2 of 4 tests assert only `toBeDefined()` and `instanceof Map` — must verify actual binding key-value pairs

### Rust bindings.test.ts

- 3 of 4 tests assert only `toBeDefined()` and `instanceof Map` — must verify `"i32"`, `"String"`, `"bool"` appear as actual values

### Rust constructor.test.ts

- 2 of 4 tests assert only `toBeDefined()` and `instanceof Map` — must verify `"Database"`, `"Point"` as actual values

### Rust member.test.ts

- Several tests check `methods.size > 0` but never verify method names or properties

**Rule: Every test that extracts a value must assert the exact expected value using `toEqual`, not just confirm something exists.**

<!-- SECTION:NOTES:END -->
