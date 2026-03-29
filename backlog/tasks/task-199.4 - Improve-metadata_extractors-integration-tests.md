---
id: TASK-199.4
title: Improve metadata_extractors integration tests
status: To Do
assignee: []
created_date: "2026-03-27 23:14"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - metadata-extractors
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

### JavaScript/TypeScript (70 tests)

- **`extract_receiver_info`** — ZERO tests (6 distinct code paths all untested)
- **`extract_is_optional_chain`** — ZERO tests (4 code paths)
- **`TYPESCRIPT_METADATA_EXTRACTORS`** — never imported/tested; TS-specific `extract_type_from_annotation` override (`type_identifier`, `generic_type`, `nested_type_identifier` branches) completely untested
- Weak assertions in tests for optional chaining and nested generics (only `toContain` or `length > 0`)

### Python (75 tests)

- **`extract_is_optional_chain`** — ZERO tests (always returns false for Python, but untested)
- `extract_receiver_info` with direct attribute node (not wrapped in call) untested
- `subscript` node branch in `extract_type_arguments` untested
- Missing null guards for `is_method_call`, `extract_call_name`, `extract_receiver_info`

### Rust (97 tests — best covered)

- **`extract_receiver_info`** — ZERO tests (function at lines 381-427 with self/non-self/undefined paths)
- **`extract_is_optional_chain`** — ZERO tests (trivial, returns false)
- `extract_call_receiver` with `field_identifier` input untested
- `extract_call_name` and `is_method_call` with `field_expression` node directly untested

## Actions

1. Add `extract_receiver_info` tests for all 3 language groups (highest priority)
2. Add `extract_is_optional_chain` tests for all languages
3. Import and test `TYPESCRIPT_METADATA_EXTRACTORS` (currently only JS extractors tested with TS parser)
4. Strengthen weak assertions in optional chaining and generics tests
5. All tests should remain inline
6. Fix production bugs discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

Several existing metadata_extractors tests have weak assertions that must be strengthened:

- **Optional chaining tests** (JS/TS): `toContain("obj")` and `result?.length > 0` → verify exact property chain arrays like `toEqual(["obj", "prop", "method"])`
- **Nested generics** (JS/TS): `result?.length > 0` → verify exact type argument strings
- **Type arguments tests** (JS/TS): wrapped in `if (generic_type)` guards that silently skip if node not found → remove guards, assert node exists, then verify exact values
- **Null guard tests** (Python): some functions missing null/undefined input tests entirely
<!-- SECTION:NOTES:END -->
