# Task: Validate and Fix All Capture Names

**Status**: In Progress
**Priority**: High
**Epic**: 11 - Codebase Restructuring
**Parent**: task-epic-11.102

## Objective

Ensure ALL capture names in .scm query files follow the pattern `@category.entity.additional.qualifiers` where:

- `category` is a valid `SemanticCategory` enum value
- `entity` is a valid `SemanticEntity` enum value
- Additional qualifiers after the first two parts provide granular context

## Background

After migrating from abbreviated names (`@def.`, `@ref.`, `@assign.`) to full enum names (`@definition.`, `@reference.`, `@assignment.`), validation revealed 376 captures with invalid category or entity names in the first two parts.

The code in `semantic_index.ts` validates:

```typescript
const parts = c.name.split(".");
const category = parts[0] as SemanticCategory;
const entity = parts[1] as SemanticEntity;
```

This validation will fail if either part is not a valid enum value.

## Valid Enum Values

### SemanticCategory

- `scope`
- `definition`
- `reference`
- `import`
- `export`
- `type`
- `assignment`
- `return`
- `decorator`
- `modifier`

### SemanticEntity (subset - see scope_processor.ts for full list)

- Scopes: `module`, `class`, `function`, `method`, `constructor`, `block`, `closure`, `interface`, `enum`, `namespace`
- Definitions: `variable`, `constant`, `parameter`, `field`, `property`, `type_parameter`, `enum_member`
- Types: `type`, `type_alias`, `type_annotation`, `type_parameters`, `type_assertion`, `type_constraint`, `type_argument`
- References: `call`, `member_access`, `type_reference`, `typeof`
- Special: `this`, `super`, `import`
- Modifiers: `access_modifier`, `readonly_modifier`, `visibility`, `mutability`, `reference`
- Other: `operator`, `argument_list`, `label`, `macro`

## Common Issues Found

### Invalid Entities (need fixing)

- `param` → should be `parameter`
- `loop_var` → should be `variable`
- `catch_param` → should be `parameter`
- `identifier` → needs context-appropriate entity (usually `variable` or `reference`)
- `receiver` → needs valid entity
- `method_call` → should be `call` or `member_access`
- `object` → needs valid entity
- `expr` → needs valid entity

### Invalid Scope Entities

- `lambda`, `for`, `while`, `with`, `if`, `elif`, `else`, `try`, `except`, `finally`, `match`, `case` → should use `block`
- Language-specific scopes need appropriate entities

### Invalid Categories

- `call` → should be `reference`

## Subtasks

- [ ] task-epic-11.103.1: Validate and fix JavaScript capture names
- [ ] task-epic-11.103.2: Validate and fix TypeScript capture names
- [ ] task-epic-11.103.3: Validate and fix Python capture names
- [ ] task-epic-11.103.4: Validate and fix Rust capture names
- [ ] task-epic-11.103.5: Verify all tests pass after fixes

## Acceptance Criteria

1. All capture names in .scm files have valid `SemanticCategory` as first part
2. All capture names in .scm files have valid `SemanticEntity` as second part
3. Language config files match updated capture names
4. Validation script reports 0 invalid captures
5. All semantic index tests pass

## Notes

- Additional parts after `category.entity` can be arbitrary - they provide context for language configs
- Language configs match on full capture name strings
- Some contextual captures used only for tree-sitter matching don't need to be processed by language configs, but they still need valid first two parts for the validation in semantic_index.ts
