# File Naming Conventions

This document defines the file and folder naming conventions for the Ariadne codebase.

## Folder-Module Naming Rule

Each folder represents a module. Files in a folder follow this structure:

```text
{folder}/
  index.ts                              # Barrel file for exports
  {folder}.ts                           # Main implementation
  {folder}.test.ts                      # Main module tests
  {folder}.{language}.ts                # Language-specific variant of main
  {folder}.{language}.test.ts           # Language-specific tests
  {submodule}.ts                        # Helper/submodule
  {submodule}.test.ts                   # Submodule tests
  {submodule}.{language}.ts             # Language-specific variant of submodule
```

The folder name provides the namespace. Sub-modules do NOT repeat the folder name.

### Language Suffix Rule

**Language identifiers ALWAYS come as a suffix, never a prefix.**

- `{thing}.{language}.ts` - language variant of `{thing}.ts`
- `{folder}.{language}.ts` - language variant of main module
- `{submodule}.{language}.ts` - language variant of submodule

This rule ensures consistent ordering: the thing being modified comes first, followed by the language variant.

**Correct:**
- `capture_handlers.python.ts` - Python variant of capture_handlers
- `imports.python.ts` - Python variant of imports submodule
- `methods.rust.ts` - Rust variant of methods submodule

**Incorrect:**
- `python.ts` - language as prefix (should be `capture_handlers.python.ts`)
- `python.imports.ts` - language as prefix (should be `imports.python.ts`)
- `rust.methods.ts` - language as prefix (should be `methods.rust.ts`)

### Examples

```text
project/
  index.ts                                # Re-exports
  project.ts                              # Main implementation
  project.test.ts                         # Main tests
  project.typescript.integration.test.ts  # Language-specific integration test
  import_graph.ts                         # Helper module
  import_graph.test.ts                    # Helper tests
  fix_import_locations.ts                 # Helper module

scopes/
  index.ts                                # Re-exports
  scopes.ts                               # Main implementation
  scopes.test.ts                          # Main tests
  utils.ts                                # Utility submodule
  utils.test.ts                           # Utility tests
  boundary_extractor.ts                   # Submodule
  boundary_base.ts                        # Base implementation

capture_handlers/
  index.ts                                # Re-exports
  types.ts                                # Types submodule
  capture_handlers.typescript.ts          # TypeScript handler (main variant)
  capture_handlers.typescript.test.ts     # TypeScript tests
  capture_handlers.javascript.ts          # JavaScript handler
  capture_handlers.python.ts              # Python handler
  capture_handlers.rust.ts                # Rust handler
  imports.python.ts                       # Python imports submodule
  imports.python.test.ts                  # Python imports tests
  methods.rust.ts                         # Rust methods submodule
  methods.rust.test.ts                    # Rust methods tests

import_resolution/
  index.ts                                # Re-exports
  import_resolution.ts                    # Main implementation
  import_resolution.typescript.ts         # Language-specific variant
  import_resolution.typescript.test.ts    # Language-specific tests
  import_resolution.javascript.ts         # Language-specific variant
  import_resolution.python.ts             # Language-specific variant
  import_resolution.rust.ts               # Language-specific variant
```

### Rationale

1. **Folder provides namespace**: The folder already declares module membership. `project/import_graph.ts` is clearly part of the project module.

2. **Less redundancy**: `project/import_graph.ts` is cleaner than `project/project.import_graph.ts`.

3. **Clearer file names**: When viewing files, `import_graph.ts` is more readable than `project.import_graph.ts`.

4. **Main file stands out**: Only `{folder}.ts` has the folder name, making the main implementation easy to identify.

5. **Language variants are clear**: `capture_handlers.typescript.ts` clearly indicates it's a TypeScript variant of capture_handlers.

6. **Consistent suffix ordering**: Language always comes last, making it easy to identify what a file is a variant of.

## Source File Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `index.ts` | Barrel file | `index.ts` |
| `{folder}.ts` | Main module | `project.ts` |
| `{folder}.test.ts` | Main tests | `project.test.ts` |
| `{folder}.integration.test.ts` | Integration tests | `project.integration.test.ts` |
| `{folder}.{aspect}.test.ts` | Aspect-specific tests | `capture_handlers.export.test.ts` |
| `{folder}.{language}.ts` | Language variant of main | `capture_handlers.python.ts` |
| `{folder}.{language}.test.ts` | Language variant tests | `capture_handlers.python.test.ts` |
| `{folder}.{language}.integration.test.ts` | Language integration tests | `project.typescript.integration.test.ts` |
| `{folder}.e2e.test.ts` | End-to-end tests | `list_functions.e2e.test.ts` |
| `{folder}.bench.test.ts` | Benchmark tests | `project.bench.test.ts` |
| `{submodule}.ts` | Helper/submodule | `import_graph.ts` |
| `{submodule}.test.ts` | Submodule tests | `utils.test.ts` |
| `{submodule}.{language}.ts` | Language variant of submodule | `imports.python.ts` |
| `{submodule}.{language}.test.ts` | Language submodule tests | `imports.python.test.ts` |

## Special Cases

### Package `src/` Root

Files directly in `packages/*/src/` (where the folder name is `src`) use simple `snake_case.ts` naming since they are package entry points:

```text
packages/mcp/src/
  server.ts
  start_server.ts
  version.ts
  list_functions.e2e.test.ts
```

### Extractor Directories

The `extractors/` directory uses prefix naming for distinct implementations that share a common interface:

```text
scopes/extractors/
  python_scope_boundary_extractor.ts
  typescript_scope_boundary_extractor.ts
  javascript_scope_boundary_extractor.ts
  rust_scope_boundary_extractor.ts
```

These are distinct implementations (not variants of a base), so the language prefix groups them logically.

### Non-TypeScript Files

Certain non-TypeScript files are allowed in `src/` directories:

- `.scm` files (tree-sitter queries)
- `.md` files (inline documentation)

## Directory Naming

| Category | Pattern | Examples |
|----------|---------|----------|
| Source directories | `snake_case` | `index_single_file`, `resolve_references` |
| Scripts directories | `scripts` | `packages/*/scripts/`, `scripts/` |

## Root Directory

### Allowed Files

```text
package.json
package-lock.json
tsconfig.json
tsconfig.tsbuildinfo
eslint.config.js
.gitignore
.npmrc
.npmignore
LICENSE
README.md
CONTRIBUTING.md
CLAUDE.md
AGENTS.md
.cursorrules
```

### Prohibited Patterns

Files matching these patterns are blocked:

```text
debug_*.ts, debug_*.js    # Debug scripts
test_*.ts, test_*.js      # Ad-hoc test scripts
verify_*.ts               # Verification scripts
*.py                      # Python scripts
*.sed                     # Sed scripts
fix_*.sh                  # Fix scripts
*_report.md               # Report files
*_analysis.md             # Analysis files
*.log                     # Log files
```

## Package Directory

### Package Root

Stray `.js` files in package roots (`packages/*/`) are prohibited, except for ESLint configs.

### Scripts Directory

Package scripts use `snake_case.ts`:

```text
packages/core/scripts/
  generate_fixtures.ts
  verify_fixtures.ts
```

## Hook Enforcement

File naming is enforced via Claude Code hooks:

### PreToolUse Hook

Validates file paths before `Write` and `Edit` operations. Blocks:

- Prohibited patterns in root directory
- Files in `packages/*/src/*/` that violate naming conventions
- Language-prefixed files (should use language suffix)
- Non-TypeScript files in src (except `.scm`, `.md`)

### Stop Hook

Audits the entire codebase before task completion. Reports:

- Any files violating naming conventions
- Suggestions for how to rename or remove violating files

### Error Messages

When a file is blocked, the error message explains:

1. What naming convention was violated
2. Valid patterns for that location
3. How to rename if it's a legitimate module
4. Suggestion to remove if it's a debug/temporary script

Example:
```
Blocked: 'python.imports.ts' has language as prefix.
Rename to: imports.python.ts (language suffix pattern)
```

## Allowed Exceptions

### Hook Scripts

```text
.claude/hooks/*.cjs       # CommonJS required for hooks
```

### Generated/Ignored

```text
dist/                     # Build output (gitignored)
node_modules/             # Dependencies (gitignored)
```
