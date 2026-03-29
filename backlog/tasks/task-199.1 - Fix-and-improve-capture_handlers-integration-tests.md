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
5. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
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

## Implementation Summary

**Test counts: 303 → 365 tests (+62), 2156 → 2207 full suite (+51)**

### Test infrastructure fixes (all 4 languages)
- Fixed `create_capture` / `create_raw_capture` / `process_capture` helpers to use `node_to_location()` instead of manual `end_column: column + 1` — fixes SymbolId mismatches between test captures and handler-internal `find_containing_*` functions
- Replaced all `handler?.()` optional chaining with `handler!()` — prevents silent no-ops if a handler key is removed
- Replaced all redundant `toBeDefined()` + `toBeInstanceOf(Function)` patterns with `typeof === "function"`

### Python (90 → 102 tests)
- Fixed 3 broken tests: `definition.param.*` → `definition.parameter.*`
- Added tests: enum (2), decorators (4), type_alias, anonymous_function, parameters (5), typed.default with output validation
- Strengthened ~15 weak `not.toThrow()` assertions to actual value checks
- Fixed aliased imports test to use source+alias capture pair

### TypeScript (56 → 70 tests)
- Added tests: interface methods/properties, enum members with values, abstract method assertions, async flag, access modifiers, parameters, decorators
- Strengthened all `toBeDefined()` / `toBeGreaterThan(0)` to exact value checks

### JavaScript (69 → 79 tests)
- Added tests: constructor, anonymous_function (both function_expression and arrow_function), import.named, import.namespace, require handlers
- Strengthened all weak assertions, replaced `?.()` with `!()`

### Rust (88 → 102 tests)
- Added tests: imports (simple, aliased, braced, wildcard, extern crate), interface.method, anonymous_function (2), variable.mut (2), type_alias.impl, parameter.closure
- Rewrote methods.rust.test.ts from 5 export-type checks to 8 real handler invocation tests

### Production bugs found and fixed
1. **`add_decorator_to_target` missing function support** — added `this.functions.get(target_id)` check so decorators on standalone functions (e.g., Flask `@app.route`) are attached. The `FunctionBuilderState.decorators` array already existed but was never populated.
2. **`find_decorator_target` property/method SymbolId mismatch** — added `has_property_decorator()` helper that checks for `@property` in the `decorated_definition` siblings. When detected, returns `property_symbol` instead of `method_symbol`, so `@property` decorators correctly attach to property definitions.
3. **TypeScript enum member capture name mismatch** — the `.scm` query used `@definition.enum_member` (underscore) but the handler registry key was `definition.enum.member` (dot). Capture names are NOT auto-normalized. Fixed the `.scm` query to use `@definition.enum.member` directly.
<!-- SECTION:NOTES:END -->
