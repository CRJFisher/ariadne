# File Naming Conventions

This document defines the file and folder naming conventions for the Ariadne codebase.

## Folder-Module Naming Rule

**Every file in a folder must be prefixed with the folder name.** This ensures each file explicitly declares its membership in the module, making it immediately clear whether a file is an intentional part of the codebase (not a debug script or temporary file).

```text
{folder}/
  {folder}.ts                              # Main implementation
  {folder}.test.ts                         # Unit tests
  {folder}.integration.test.ts             # Integration tests
  {folder}.e2e.test.ts                     # End-to-end tests
  {folder}.bench.test.ts                   # Benchmark tests
  {folder}.{submodule}.ts                  # Helper/submodule
  {folder}.{submodule}.test.ts             # Submodule tests
  {folder}.{language}.ts                   # Language-specific variant
  {folder}.{language}.test.ts              # Language-specific tests
  {folder}.{language}.{submodule}.ts       # Language + submodule
  index.ts                                 # Barrel file (only exception)
```

### Examples

```text
project/
  project.ts                               # Main implementation
  project.test.ts                          # Unit tests
  project.import_graph.ts                  # Helper module
  project.import_graph.test.ts             # Helper module tests
  project.typescript.integration.test.ts   # Language-specific integration test
  index.ts                                 # Re-exports

scopes/
  scopes.ts                                # Main implementation
  scopes.test.ts                           # Unit tests
  scopes.utils.ts                          # Utility submodule
  scopes.utils.test.ts                     # Utility tests
  scopes.boundary_extractor.ts             # Submodule
  scopes.boundary_extractor.test.ts        # Submodule tests
  scopes.boundary_base.ts                  # Base implementation
  index.ts                                 # Re-exports

capture_handlers/
  capture_handlers.typescript.ts           # Language-specific
  capture_handlers.javascript.ts           # Language-specific
  capture_handlers.python.ts               # Language-specific
  capture_handlers.rust.ts                 # Language-specific
  capture_handlers.rust.methods.ts         # Language + submodule
  capture_handlers.types.ts                # Types submodule
  index.ts                                 # Re-exports
```

### Rationale

The folder-prefix requirement:

1. **Signals intentionality**: A file named `project.import_graph.ts` is clearly an intentional part of the `project` module. A file named `random_script.ts` would be immediately flagged as suspicious.

2. **Prevents debug script accumulation**: Debug scripts like `test_something.ts` or `debug_issue.ts` are blocked because they don't follow the pattern.

3. **Self-documenting imports**: Import paths become explicit about what module they belong to:
   ```typescript
   import { ImportGraph } from "./project.import_graph";
   ```

4. **Disambiguates when viewing multiple files**: When you have several files open, `project.import_graph.ts` is clearer than `import_graph.ts`.

## Source File Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `{folder}.ts` | Main module | `project.ts` |
| `{folder}.test.ts` | Unit tests | `project.test.ts` |
| `{folder}.integration.test.ts` | Integration tests | `project.integration.test.ts` |
| `{folder}.e2e.test.ts` | End-to-end tests | `list_functions.e2e.test.ts` |
| `{folder}.bench.test.ts` | Benchmark tests | `project.bench.test.ts` |
| `{folder}.{submodule}.ts` | Helper/submodule | `project.import_graph.ts` |
| `{folder}.{submodule}.test.ts` | Submodule tests | `scopes.utils.test.ts` |
| `{folder}.{language}.ts` | Language variant | `capture_handlers.typescript.ts` |
| `{folder}.{language}.test.ts` | Language tests | `capture_handlers.python.test.ts` |
| `{folder}.{language}.{submodule}.ts` | Language + submodule | `capture_handlers.rust.methods.ts` |
| `index.ts` | Barrel file | `index.ts` |

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
  javascript_typescript_scope_boundary_extractor.ts
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
- Files in `packages/*/src/*/` that don't start with the folder name
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
Blocked: 'import_graph.ts' must start with 'project.' per folder-module naming convention.
Valid patterns: project.ts, project.{submodule}.ts, project.{submodule}.test.ts
If this is a helper module, rename to: project.import_graph.ts
If this is a debug/temporary script, it should be removed.
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
