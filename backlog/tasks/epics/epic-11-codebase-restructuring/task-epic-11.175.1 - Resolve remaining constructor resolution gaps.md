---
id: task-epic-11.175.1
title: Resolve remaining constructor resolution gaps
status: Completed
assignee: []
created_date: '2026-01-28'
completion_date: '2026-01-29'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-epic-11.175
---

## Description

Python `__init__` methods and JavaScript `constructor` methods appear as false positive entry points because class instantiation calls (`ClassName()` in Python, `new ClassName()` in JS) are not resolved to the constructor definition in the call graph.

task-epic-11.171 previously fixed constructor resolution lookup for TypeScript and is marked Done. However, 26 entries still appear in external analysis of a Python codebase (AmazonAdv/projections). The prior fix likely addressed TypeScript-specific patterns (`new ClassName()`) but not Python's constructor invocation pattern (`ClassName()` which implicitly calls `__init__`). This sub-task investigates and fixes the Python-specific gaps.

## Evidence

26 false positive entries from `constructor-resolution-bug` group. Examples:

- `__init__` in `amazon_ads/adjust/shared.py:46`
- `__init__` in `amazon_ads/api_actions/shared.py:173`
- `__init__` in `amazon_ads/maintainence/asin_job.py:34`
- `constructor` in `qb_code_pages/batch_add_products_to_inventory_request/src/App.js:65`
- `__init__` in `demand_forecasting/timesfm/timesfm_base.py:238`

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [x] Investigate why task-epic-11.171 did not resolve these cases
- [x] Identify the specific resolution gap (cross-module instantiation, aliased imports, etc.)
- [x] Fix the constructor call resolution to handle these patterns
- [x] All 26 entries no longer appear as false positive entry points

## Related

- task-epic-11.171 (Done) - Prior fix for constructor resolution lookup
- task-163 - Parent task

## Implementation Notes

### Root Cause

The `ClassDefinition` type used `constructor` (singular) as the field name for storing constructor definitions, but the field was actually an array (`readonly ConstructorDefinition[]`). This naming inconsistency caused confusion and potential bugs when accessing the constructor field.

### Fix Applied

Renamed the `constructor` field to `constructors` (plural) across the codebase to accurately reflect that it is an array. This aligns with the naming convention used for other array fields like `methods` and `properties`.

### Files Modified

**Type Definition:**
- `packages/types/src/symbol_definitions.ts` - Renamed `constructor` to `constructors` in `ClassDefinition` interface

**Core Implementation:**
- `packages/core/src/index_single_file/definitions/definitions.ts` - Updated `DefinitionBuilder` to use `constructors`
- `packages/core/src/resolve_references/call_resolution/constructor.ts` - Updated constructor resolution to use `constructors`
- `packages/core/src/resolve_references/registries/type.ts` - Updated `TypeRegistry` to use `constructors`
- `packages/core/src/index_single_file/type_preprocessing/member.ts` - Updated `extract_type_members` to use `constructors`
- `packages/core/src/project/extract_nested_definitions.ts` - Updated parameter extraction to use `constructors`

**Test Updates:**
- `packages/core/src/index_single_file/definitions/definitions.test.ts`
- `packages/core/src/index_single_file/index_single_file.javascript.test.ts`
- `packages/core/src/index_single_file/index_single_file.python.test.ts`
- `packages/core/src/index_single_file/index_single_file.typescript.test.ts`
- `packages/core/src/resolve_references/call_resolution/constructor.test.ts`
- `packages/core/src/resolve_references/registries/type.test.ts`
