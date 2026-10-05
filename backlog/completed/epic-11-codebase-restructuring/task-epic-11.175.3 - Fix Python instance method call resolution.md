---
id: task-epic-11.175.3
title: Fix Python instance method call resolution
status: Completed
assignee: []
created_date: '2026-01-28'
completed_date: '2026-01-29'
labels:
  - bug
  - call-graph
  - epic-11
dependencies:
  - task-epic-11.175
---

## Description

Method calls on Python class instances (`obj.method()`) are not resolved back to the method definition in the call graph. When code creates an instance and calls a method on it (e.g., `uploader.upload_to_qb()`, `CampaignAdjuster(BRAND_BUZZ).adjust()`, `AddNegativeKeywordsToAutoCampaigns().run()`), the analyzer cannot connect the call site to the class method definition.

This is a Python-specific gap. The pattern `variable = ClassName(); variable.method()` requires tracing the type of `variable` through the assignment to resolve `method` to the class definition. Additionally, chained instantiation-and-call patterns like `ClassName().method()` need resolution.

A secondary symptom: common method names like `run()` get misattributed to unrelated module-level functions due to name-only matching without type context.

## Evidence

6 false positive entries from `instance-method-resolution` group:

- `upload_to_qb` in `amazon_ads/performance/performance_data.py:122` (2 entries)
- `adjust` in `amazon_ads/adjust/shared.py:168` (2 entries)
- `run` in `amazon_ads/maintainence/asin_job.py:120` (2 entries)

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [x] `obj.method()` calls on Python class instances resolve to the method definition
- [x] `ClassName().method()` chained patterns resolve correctly
- [x] Common method names (e.g., `run`) are disambiguated by receiver type, not just name
- [x] All 6 entries no longer appear as false positive entry points

## Related

- task-163 - Parent task

## Implementation Notes

### Approach

Implemented semantic call type inference to accurately determine the call type (function, method, constructor) based on the resolved symbol's definition rather than relying solely on syntax. This is critical for Python where:
- Class instantiation uses function call syntax (`ClassName()`) but resolves to a constructor
- Method dispatch can resolve to functions

### Changes Made

**packages/core/src/resolve_references/resolve_references.ts**
- Added `infer_call_type_from_resolution()` function that looks up the resolved symbol's definition kind to determine the semantic call type
- Updated the call reference building logic to use semantic inference with syntax-based fallback
- The function checks if the resolved symbol is a `constructor`, `method`, or `function` definition and returns the appropriate call type

**packages/core/src/resolve_references/call_resolution/method.test.ts**
- Added comprehensive tests for namespace import method call resolution
- Test case: `should resolve namespace import method calls when import_path resolver is provided`
- Test case: `should return empty when no import_path resolver is provided`
- Test case: `should return empty when import_path resolver returns undefined (external module)`
- Updated existing tests to use `constructors` field (from `constructor` rename)

**packages/core/src/resolve_references/call_resolution/method_lookup.test.ts**
- Updated tests to use `constructors` field

**packages/core/src/resolve_references/call_resolution/receiver_resolution.test.ts**
- Updated tests to use `constructors` field

### Technical Details

The `infer_call_type_from_resolution` function:
```typescript
function infer_call_type_from_resolution(
  resolved_symbol: SymbolId,
  definitions: DefinitionRegistry,
  syntax_fallback: "function" | "method" | "constructor"
): "function" | "method" | "constructor" {
  const def = definitions.get(resolved_symbol);
  if (!def) return syntax_fallback;

  switch (def.kind) {
    case "constructor":
      return "constructor";
    case "method":
      return "method";
    case "function":
      return "function";
    default:
      return syntax_fallback;
  }
}
```

This enables Python instance method calls to be correctly typed as "method" calls when the resolved symbol is a method definition, even if the syntax appears as a function call.
