---
id: task-175.4
title: Fix Python module-qualified call resolution
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

Function calls made through Python module-qualified names (`module.function()`) or module-aliased imports (`import x as y; y.function()`) are not resolved in the call graph. The analyzer does not trace Python import statements to connect attribute access on module objects to function definitions.

This is a Python-specific pattern. In Python, `import module` followed by `module.function()` is the standard calling convention. The call graph needs to resolve the module reference through the import to find the target function definition.

## Evidence

5 false positive entries from `module-qualified-call-resolution` group:

- `is_performance_good` in `amazon_ads/create_campaigns/similar_item_keywords.py:282`
- `generate_predictions_at_date` in `demand_forecasting/predict/generate.py:26`
- `save_photos_in_brandfolder_dropbox_and_s3` in `product_photos/runtime/final_io.py:44`
- `qb_to_csv_text` in `quickbase/read.py:442`
- `get_order_history_df` in `demand_forecasting/planner_predictions_evaluation/planner_predictions_evaluation.py:152`

Full list in triage output: `entrypoint-analysis/analysis_output/external/triage_entry_points/2026-01-28T10-37-37.434Z.json`

## Acceptance Criteria

- [x] `import module; module.function()` calls resolve to the function definition
- [x] `import module as alias; alias.function()` calls resolve correctly
- [x] `from package import module; module.function()` calls resolve correctly
- [x] All 5 entries no longer appear as false positive entry points

## Related

- task-epic-11.175 - Parent task

## Implementation Notes

### Approach

Fixed Python module-qualified call resolution by improving aliased import handling and adding semantic call type inference.

### Key Changes

1. **Aliased Import Symbol ID Consistency** (imports.python.ts)
   - For aliased imports (`import X as Y` / `from X import Y as Z`), the symbol_id now uses the alias location instead of the module/name location
   - This ensures the symbol_id matches what scope resolution returns when looking up the alias name
   - Added early return for alias capture nodes to prevent duplicate processing

2. **Semantic Call Type Inference** (resolve_references.ts)
   - Added `infer_call_type_from_resolution()` function that determines call type from the resolved symbol's definition kind
   - This is more accurate than relying solely on syntax because Python class instantiation uses function call syntax but should resolve to constructor
   - The function falls back to syntax-based type when definition not found

3. **Reference Preprocessing Infrastructure** (preprocess_references.ts, preprocess_references.python.ts)
   - Added language-dispatch preprocessing phase called AFTER name resolution but BEFORE type resolution
   - For Python: converts class instantiation function_call references to constructor_call when the callee resolves to a class definition
   - Enables proper type binding via extract_constructor_bindings()

4. **Potential Constructor Target Extraction** (references.ts, factories.ts)
   - Added `potential_construct_target` field to FunctionCallReference type
   - For Python function calls in assignment context, extracts the target variable location
   - This metadata enables the preprocessing phase to create proper ConstructorCallReference

5. **Integration Tests** (project.python.integration.test.ts)
   - Added tests for `import X as Y; Y.func()` pattern resolution
   - Added tests for `from X import Y as Z; Z()` aliased named import resolution
   - Verified that module-qualified calls correctly resolve and remove false positive entry points

### Files Modified

- packages/core/src/index_single_file/query_code_tree/capture_handlers/imports.python.ts
- packages/core/src/index_single_file/references/references.ts
- packages/core/src/index_single_file/references/factories.ts
- packages/core/src/resolve_references/resolve_references.ts
- packages/core/src/resolve_references/preprocess_references.ts (new)
- packages/core/src/resolve_references/preprocess_references.python.ts (new)
- packages/core/src/resolve_references/preprocess_references.test.ts (new)
- packages/core/src/resolve_references/preprocess_references.python.test.ts (new)
- packages/core/src/project/project.ts
- packages/core/src/project/project.python.integration.test.ts
- packages/types/src/symbol_references.ts
- packages/core/src/resolve_references/call_resolution/method.test.ts
