# Task 11.161.2: Fix Other File Naming Violations

## Status: Completed

## Parent: Task 11.161

## Goal

Audit and fix file naming violations outside of `language_configs/`.

## Naming Convention Summary

### Folder-Module Rule

The folder name defines the main module name:

```text
{folder}/
  {folder}.ts                              # Main implementation
  {folder}.test.ts                         # Unit tests
  {folder}.{language}.ts                   # Language-specific variant
  {folder}.{language}.{submodule}.ts       # Language + sub-split
  {folder}.integration.test.ts             # Integration tests
```

### Exception: Distinct Implementations

In dedicated directories (`extractors/`, etc.), use prefix pattern:

```text
{language}_{module}.ts
```

This is for distinct implementations, not variants of a base module.

## Subtasks

### 11.161.2.1: Rename Files to Match Folder Convention

See [task-epic-11.161.2.1-Rename-files-to-match-folder-convention.md](task-epic-11.161.2.1-Rename-files-to-match-folder-convention.md)

Comprehensive list of all files that need renaming to match folder names across 10 directories.

### 11.161.2.2: Document scopes/extractors/ as Exception (Completed)

The `scopes/extractors/` directory uses prefix pattern. Documented in `file-naming-conventions.md`.

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
