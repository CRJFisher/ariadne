---
id: TASK-199.6.1
title: Strengthen member extraction tests and add Python Protocol/Enum tests
status: Done
assignee: []
created_date: "2026-03-30 10:45"
updated_date: "2026-03-30 10:45"
labels:
  - testing
  - type-preprocessing
dependencies: []
parent_task_id: TASK-199.6
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Strengthen weak assertions in `member.test.ts` across all four languages and add missing Python Protocol/Enum member extraction tests.

## Actions

1. **Strengthen member.test.ts weak assertions** — replace all `toBeGreaterThan(0)`, `toBeGreaterThanOrEqual`, and count-based comments with exact method/property name verification using `toEqual`. Every test that extracts members must assert the exact expected names.

2. **Add Python Protocol member extraction test** — test that a class using `typing.Protocol` has its methods extracted as members.

3. **Add Python Enum member extraction test** — test that an `enum.Enum` subclass has its members extracted.

4. **Fix production bugs** discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.

## Specific weak assertions to fix

### JavaScript (member.test.ts)

- `should extract class methods`: uses `toBeGreaterThan(0)` instead of asserting exact member count
- `should extract class properties`: uses `toBeDefined()` on constructor, doesn't verify property extraction
- `should track class inheritance`: checks `extends !== undefined` but doesn't verify the extends array content (note: JS extends not captured — verify and document)

### TypeScript (member.test.ts)

- `should extract class methods and properties`: uses `toBeGreaterThan(0)` for methods and properties, duplicate assertion on line 224
- `should track constructor`: uses `toBeDefined()` only
- `should extract interface methods and properties`: uses `toBeDefined()` only, notes methods/properties not extracted — verify and assert exact state
- `should track interface extension`: uses `toBeGreaterThan(0)` and doesn't verify extends content
- `should handle static and instance methods`: uses `toBeGreaterThanOrEqual(1)`, doesn't check `create` method presence

### Python (member.test.ts)

- `should extract class methods`: uses `toBeGreaterThanOrEqual(2)`, uses `.some()` partial match instead of exact check
- `should extract class with __init__ constructor`: uses `toBeDefined()` only
- `should handle static methods`: uses `toBeGreaterThanOrEqual(1)` with no method name check

### Rust (member.test.ts)

- `should extract struct methods from impl block`: uses `toBeGreaterThan(0)` with no method name check
- `should extract enum methods`: uses `toBeGreaterThan(0)` without verifying enum member structure
- `should handle struct with fields`: uses `toBeGreaterThan(0)` with no method name check

<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

All tests are in `packages/core/src/index_single_file/type_preprocessing/member.test.ts`.

**Rule: Every test that extracts a value must assert the exact expected value using `toEqual`, not just confirm something exists.**

<!-- SECTION:NOTES:END -->
