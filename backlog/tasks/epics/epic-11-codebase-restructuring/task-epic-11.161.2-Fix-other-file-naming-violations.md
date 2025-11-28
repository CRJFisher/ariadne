# Task 11.161.2: Fix Other File Naming Violations

## Status: Planning

## Parent: Task 11.161

## Goal

Audit and fix file naming violations outside of `language_configs/`.

## Naming Convention Summary

### Standard Pattern

```
{module_name}.ts                           # Core implementation
{module_name}.test.ts                      # Unit tests
{module_name}.{language}.ts                # Language-specific variant
{module_name}.{language}.test.ts           # Language-specific tests
{module_name}.integration.test.ts          # Integration tests
{module_name}.{language}.integration.test.ts
```

### Exception: Distinct Implementations

In dedicated directories (`extractors/`, etc.), use prefix pattern:

```
{language}_{module}.ts
```

This is for distinct implementations, not variants of a base module.

## Subtasks

### 11.161.2.1: Rename Test Files to Convention

Audit and fix test files:

| Current | Should Be |
|---------|-----------|
| `javascript_typescript_scope_boundary_extractor.test.ts` | Keep (tests both languages) |

Most test files already follow convention. Verify compliance:

- `semantic_index.typescript.test.ts` - Correct
- `import_resolver.python.test.ts` - Correct
- `project.rust.integration.test.ts` - Correct

### 11.161.2.2: Document scopes/extractors/ as Exception

The `scopes/extractors/` directory uses prefix pattern:

- `python_scope_boundary_extractor.ts`
- `typescript_scope_boundary_extractor.ts`
- `javascript_scope_boundary_extractor.ts`
- `rust_scope_boundary_extractor.ts`

**Decision**: Keep as exception. These are distinct implementations, not variants.

Document in `file-naming-conventions.md`.

## Files to Audit

### index_single_file/

- `semantic_index.typescript.test.ts` - OK
- `semantic_index.javascript.test.ts` - OK
- `semantic_index.python.test.ts` - OK
- `semantic_index.rust.test.ts` - OK

### resolve_references/import_resolution/

- `import_resolver.typescript.test.ts` - OK
- `import_resolver.javascript.test.ts` - OK
- `import_resolver.python.test.ts` - OK
- `import_resolver.rust.test.ts` - OK

### project/

- `project.typescript.integration.test.ts` - OK
- `project.javascript.integration.test.ts` - OK
- `project.python.integration.test.ts` - OK
- `project.rust.integration.test.ts` - OK

### scopes/extractors/

- Uses prefix pattern - Document as exception

## Success Criteria

1. All test files follow naming convention
2. Exception directories documented
3. No remaining naming violations
