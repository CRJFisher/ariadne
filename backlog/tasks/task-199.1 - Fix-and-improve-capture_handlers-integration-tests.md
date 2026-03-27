---
id: TASK-199.1
title: Fix and improve capture_handlers integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:13"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - capture-handlers
dependencies: []
parent_task_id: TASK-199
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

### TypeScript (61 tests)

- **12 of 22 TS-specific handlers lack real coverage** — handler never invoked or assertions are superficial
- Incomplete placeholder tests for `definition.interface.method`, `definition.interface.property`, all 3 decorator handlers, `definition.field.param_property`
- Missing: `definition.method` (access_modifier, abstract, static, async, return_type), `definition.parameter`, `definition.enum.member`, `definition.method.private`, `definition.method.abstract`

### JavaScript (65 tests)

- **`definition.anonymous_function`** handler untested (callback detection tested separately but not through handler)
- **All CommonJS require handlers** untested: `definition.import.require`, `definition.import.require.simple`
- **`definition.import.named`**, **`definition.import.namespace`** untested
- **8 granular re-export handlers** untested individually
- `definition.constructor` — no test verifies constructor attachment to class

### Python (60+ tests, 42 handler keys)

- **3 BROKEN tests** using wrong key names (`definition.param.*` → should be `definition.parameter.*`), passing vacuously
- **9 handlers have zero tests**: enum (`definition.enum`, `definition.enum_member`), all 4 decorator handlers, `definition.type_alias`, `definition.anonymous_function`
- **~11 handlers** have only existence/does-not-throw tests
- All 6 parameter handlers lack output validation

### Rust (88 tests)

- **`definition.import`** (use declarations + extern crate) — zero test coverage despite complex 6-path handler
- **`definition.interface.method`** (trait method signatures) — untested
- **`definition.anonymous_function`**, **`definition.variable.mut`**, **`definition.type_alias.impl`**, **`definition.parameter.closure`** — untested
- Parameters have weak `toBeDefined()` assertions only

## Actions

1. Fix 3 broken Python tests (wrong handler key names)
2. Add behavioral tests for untested handlers (prioritize: import handlers, enum/decorator handlers, parameter handlers)
3. Strengthen weak assertions from `toBeDefined()` to actual value checks
4. All tests should use inline code (appropriate for this module)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

Across all languages, many tests use weak assertions (`toBeDefined()`, `instanceof Map`, `toHaveLength(>0)`, `not.toThrow()`) that pass even when zero data is extracted. **All weak assertions must be replaced with exact expected value checks** using `toEqual` with typed literal objects.

Examples of patterns to fix:

- `expect(result).toBeDefined()` → `expect(result.name).toEqual("MyClass")`
- `expect(metadata).toBeInstanceOf(Map)` → `expect(metadata.get(key)).toEqual(expectedValue)`
- `handler?.()` with `not.toThrow()` → invoke handler and verify builder output
- Python: 3 broken tests silently pass via optional chaining — fix key names AND add output validation
<!-- SECTION:NOTES:END -->
