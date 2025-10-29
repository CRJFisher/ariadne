# Task Epic 11.154.5: Fix JavaScript Query Captures

**Parent Task**: 11.154 - Standardize and Validate Query Capture Schemas
**Status**: Pending
**Priority**: High
**Complexity**: Low
**Time Estimate**: 1 day

---

## Objective

Refactor JavaScript query file to match TypeScript patterns (similar languages, similar captures).

---

## Scope

**File**: `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`

Apply same fixes as TypeScript - remove duplicate captures, use single `@reference.call`.

---

## Acceptance Criteria

- [ ] Validation passes
- [ ] JavaScript semantic index tests pass
- [ ] Patterns consistent with TypeScript

---

## Dependencies

- Task 11.154.4 (use TypeScript as template)

---

## Time: 1 day
