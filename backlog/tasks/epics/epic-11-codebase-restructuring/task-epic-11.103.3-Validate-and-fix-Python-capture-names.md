# Task: Validate and Fix Python Capture Names

**Status**: Not Started
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.103

## Objective

Fix all invalid capture names in `python.scm` and update `python_builder.ts` accordingly.

## Current Issues (90 invalid captures)

### Invalid scope entities:

- `@scope.lambda` → should be `@scope.closure`
- `@scope.for/while/with/if/elif/else/try/except/finally/match/case` → should be `@scope.block`
- `@scope.comprehension` → should be `@scope.block`

### Invalid definition entities:

- `@definition.lambda` → should be `@definition.function` or `@definition.closure`
- `@definition.param` → should be `@definition.parameter`
- `@definition.loop_var` → should be `@definition.variable`
- `@definition.comprehension_var` → should be `@definition.variable`
- `@definition.except_var` → should be `@definition.variable`
- `@definition.with_var` → should be `@definition.variable`

### Invalid assignment entities:

- `@assignment.lambda/var/typed/multiple/tuple` → use valid entities
- `@assignment.target/source` → use valid entities

### Invalid decorator entities:

- `@decorator.static/classmethod` → add additional qualifiers to valid entity

### Invalid reference entities:

- Same patterns as JavaScript (receiver, method_call, chain, object, assign, etc.)
- `@reference.augment` → use valid entity
- `@reference.decorator/self/cls/delete/assert/yield` → use valid entities

### Invalid type entities:

- `@type.annotation` → should be `@type.type_annotation`

## Files to Update

- `packages/core/src/index_single_file/query_code_tree/queries/python.scm`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.test.ts`

## Acceptance Criteria

- [ ] All captures in python.scm have valid category and entity
- [ ] Language config updated to match
- [ ] Validation script reports 0 invalid captures for Python
- [ ] Python semantic index tests pass
