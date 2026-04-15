---
id: TASK-199.6
title: Improve type_preprocessing integration tests
status: Done
assignee: []
created_date: "2026-03-27 23:14"
updated_date: "2026-04-01 21:33"
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

1. ~~Strengthen weak assertions across Python and Rust (verify actual extracted values, not just `toBeDefined()`)~~ — **DONE** for alias, bindings, constructor; **REMAINING** for member.test.ts → TASK-199.6.1
2. Add TypeScript enum extraction test (currently only Rust covers enums) → TASK-199.6.2
3. Add Python Protocol and Enum member extraction tests → TASK-199.6.1
4. Add Rust `Type::new()` associated function construction test → TASK-199.6.2
5. ~~Add Python 3.12 `type` statement test~~ — **DONE**
6. ~~All tests should remain inline~~ — **DONE** (all tests are inline)
7. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.

## Progress

### Completed (uncommitted)

- **alias.test.ts**: Fixed 2 Python weak assertions (TypeAlias annotation → size 0, assignment-based → size 0). Added PEP 695 `type` statement test. Added Rust trait associated type negative test.
- **bindings.test.ts**: Fixed 3 Python weak assertions (function params, class attributes, method params → exact values). Fixed 3 Rust weak assertions (function params, struct fields, impl methods → exact values). Added TS variable annotations negative test, getter/setter test, abstract class test. Added Python @classmethod test.
- **constructor.test.ts**: Fixed JS standalone constructor (→ size 0). Fixed TS generic constructor (→ exact `"Container"`).
- **typescript.scm**: Fixed duplicate `@definition.*` captures on parent nodes (interface, type_alias, enum, namespace, type_parameter, field).

### Remaining → split into TASK-199.6.1 and TASK-199.6.2

<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

### COMPLETED

- ✅ Python alias.test.ts — fixed (assertions now verify size 0 or exact values)
- ✅ Python bindings.test.ts — fixed (exact binding values verified)
- ✅ Rust bindings.test.ts — fixed (exact binding values verified)
- ✅ Rust constructor.test.ts — fixed (exact values verified)

### REMAINING → TASK-199.6.1

- ❌ member.test.ts (JS, TS, Python, Rust) — still uses `toBeGreaterThan(0)`, `toBeGreaterThanOrEqual`, no method name verification

**Rule: Every test that extracts a value must assert the exact expected value using `toEqual`, not just confirm something exists.**

<!-- SECTION:NOTES:END -->
