# Task: Validate and Fix JavaScript Capture Names

**Status**: Not Started
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.103

## Objective

Fix all invalid capture names in `javascript.scm` and update `javascript_builder.ts` accordingly.

## Current Issues (36 invalid captures)

### Invalid entities that need fixing:

- `@reference.identifier` → use valid entity based on context
- `@reference.receiver` → use valid entity
- `@reference.method_call` → change to `@reference.call` or `@reference.member_access`
- `@reference.chain` → use valid entity
- `@reference.object` → use valid entity
- `@reference.assign` → use valid entity for assignment targets/sources
- `@reference.update` → use valid entity
- `@reference.jsx` → use valid entity or add to enum
- `@reference.ref` → use valid entity
- `@assignment.expr` → use valid entity
- `@assignment.member` → use valid entity
- `@reference.return` → should be `@return.variable` or similar

## Strategy

1. Map each invalid capture to appropriate valid category.entity
2. Preserve additional qualifiers (e.g., `@reference.call.chained`)
3. Update language config to match new names
4. Ensure all processed captures have valid first two parts

## Files to Update

- `packages/core/src/index_single_file/query_code_tree/queries/javascript.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts`

## Acceptance Criteria

- [ ] All captures in javascript.scm have valid category and entity
- [ ] Language config updated to match
- [ ] Validation script reports 0 invalid captures for JavaScript
- [ ] JavaScript semantic index tests pass
