---
paths: packages/*/src/**
---

# File Naming Conventions

## Folder-Module Naming Rule

Each folder represents a module. The folder name provides the namespace, so sub-modules do NOT repeat the folder name.

```text
{folder}/
  index.ts                       # Barrel file for exports
  {folder}.ts                    # Main implementation
  {folder}.test.ts               # Main tests
  {folder}.{language}.ts         # Language-specific variant (suffix, not prefix!)
  {submodule}.ts                 # Helper/submodule (no folder prefix)
  {submodule}.test.ts            # Submodule tests
  {submodule}.{language}.ts      # Language variant of submodule
```

### Language Suffix Rule

Language identifiers ALWAYS come as a suffix, never a prefix:
- `imports.python.ts` - correct
- `python.imports.ts` - incorrect (blocked by hook)

Supported languages: typescript, javascript, python, rust, go, java

### Special Cases

- **Package `src/` root**: Files directly in `packages/*/src/` use simple `snake_case.ts`
- **Extractor directories**: Use prefix naming (`python_scope_boundary_extractor.ts`)
- **Non-TS files**: `.scm` and `.md` files allowed in `src/`
- **Special allowed**: `test_utils.ts` (test utilities, not ad-hoc tests)

## Naming Philosophy

File names describe their responsibility, not their category.

**Preferred** (functionality-descriptive):
- `detect_test_file.ts` - describes what it does
- `resolve_module_path.ts` - describes its purpose

**Avoid** (category-descriptive):
- `file_utils.ts` - generic, unclear purpose
- `helpers.ts` - too broad

## Language-Specific Marshalling Pattern

When functionality varies by language, use a marshalling file that dispatches to language-specific implementations:

```text
{functionality}/
  {functionality}.ts              # Marshalling file - routes by language
  {functionality}.typescript.ts   # TypeScript implementation
  {functionality}.python.ts       # Python implementation
```

Examples: `import_resolution.ts`, `capture_handlers.ts`

## Hook Enforcement

File naming is enforced by `.claude/hooks/file_naming_validator.cjs`. Violations are blocked with suggestions for correct names.
