---
id: TASK-199.17
title: "Remediate remaining weak test assertions across test suite"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - testing
  - test-quality
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.rust.test.ts
  - packages/core/src/index_single_file/query_code_tree/metadata_extractors/metadata_extractors.python.test.ts
  - packages/core/src/index_single_file/scopes/scopes.test.ts
  - packages/core/src/project/project.rust.integration.test.ts
parent_task_id: TASK-199
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The task-199 epic aimed to replace all weak assertions with exact value checks. Most were remediated, but several remain across 4 test files.

### metadata_extractors.rust.test.ts

- **7+ tests wrapped in `if` guards** (lines 177, 251, 265, 471, 889, 946, 960, 1026, 1095, 1108, 1192) that silently pass when the node is absent. Remove guards, add explicit `expect(node).toBeDefined()` before the assertion block.
- **`toContain` assertions** (lines 546-548, 1046-1048) where `toEqual` is possible
- **Trivially-true assertion** (line 965): `result === undefined || result.length > 0` — always true
- **`toBeGreaterThan(0)`** (line 1064) with `toContain("Vec")` — replace with exact value

### metadata_extractors.python.test.ts

- **Subscript property chain tests** (lines 382-383, 395-396): `toContain("obj")` / `toContain("prop")` should be `toEqual(["obj", "prop"])`
- **Union type name** (line 99): `toContain("|")` should be exact string check
- **Type arguments tests** (lines 606, 630, 642-643, 667-668, 680-681): `toContain` should be `toEqual`

### scopes.test.ts

- **Line 696**: `toBeGreaterThanOrEqual(min_expected - 1)` — replace with exact count
- **Line 710**: `toBeGreaterThan(0)` — replace with exact count

### project.rust.integration.test.ts

- **Call graph tests** (lines 777, 791, 814-815, 852, 865): `toBeGreaterThan(0)` / `toBeGreaterThan(initial_count)` — pin exact values
- **File removal test** (line 760): `if (helper_call)` guard silently skips assertion — make unconditional
- **Pub use re-exports test** (line 933): `if (resolved_add)` guard silently skips — make unconditional

### Actions

1. Fix all `if`-guard assertions: add `expect(x).toBeDefined()` then use the value unconditionally
2. Replace all `toContain` with `toEqual` where the exact value is deterministic
3. Replace all `toBeGreaterThan(0)` with exact expected counts
4. Remove the trivially-true assertion pattern
<!-- SECTION:DESCRIPTION:END -->
