# Task: Validate and Fix TypeScript Capture Names

**Status**: Not Started
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.103

## Objective

Fix all invalid capture names in `typescript.scm` and update `typescript_builder.ts` accordingly.

## Current Issues (68 invalid captures)

### Invalid entities that need fixing:

- `@type.alias` → incomplete pattern, needs valid entity
- `@definition.type_param` → should be `@definition.type_parameter`
- `@type.constraint` → add `type_constraint` to entity enum or map differently
- `@definition.param` → should be `@definition.parameter`
- `@definition.catch_param` → should be `@definition.parameter`
- `@definition.loop_var` → should be `@definition.variable`
- `@definition.arrow` → should be `@definition.function`
- `@assignment.target/source` → use valid entities
- `@assignment.var` → use valid entity
- `@reference.receiver/method_call/chain/object/assign` → same as JavaScript
- `@call.generic` → invalid category, should be `@reference.call.generic`

### Additional TypeScript-specific issues:

- `@definition.param_property` → should be `@definition.parameter` with additional qualifier
- `@type.type_annotationd` → typo, should be `type_annotation`
- `@definition.return_type` → should be `@type.type_annotation`

## Files to Update

- `packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder.test.ts`

## Acceptance Criteria

- [ ] All captures in typescript.scm have valid category and entity
- [ ] Language config updated to match
- [ ] Validation script reports 0 invalid captures for TypeScript
- [ ] TypeScript semantic index tests pass
