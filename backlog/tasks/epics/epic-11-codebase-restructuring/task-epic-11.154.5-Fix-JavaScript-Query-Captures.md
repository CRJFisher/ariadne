# Task Epic 11.154.5: Fix JavaScript Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Low
**Time Estimate**: 1 day

---

## Objective

Refactor JavaScript query file to use complete captures and match TypeScript patterns (similar languages, similar captures).

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

Apply same fixes as TypeScript - remove duplicate captures, use single `@reference.call`.

---

## Implementation Steps

Same as Task 11.154.4 but for JavaScript:

1. Update `javascript.scm` - remove duplicates, use complete captures
2. Verify `javascript_metadata.ts` extractors work
3. Update `javascript_builder_config.ts` if needed
4. Update test files
5. Run validation

---

## Acceptance Criteria

- [ ] `javascript.scm` has no duplicate/fragment captures
- [ ] Extractors (`javascript_metadata.ts`) work with complete captures
- [ ] All JavaScript semantic index tests pass
- [ ] Validation passes with 0 errors, 0 warnings
- [ ] Patterns consistent with TypeScript

---

## Files Modified

- `queries/javascript.scm`
- `language_configs/javascript_metadata.ts` (verify/update)
- `language_configs/javascript_builder.ts` (verify)
- `semantic_index.javascript.test.ts`
- `javascript_metadata.test.ts`

---

## Dependencies

- Task 11.154.4 (use TypeScript as template)

---

## Time: 1 day
