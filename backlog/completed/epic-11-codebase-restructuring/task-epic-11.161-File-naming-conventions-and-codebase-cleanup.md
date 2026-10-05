# Task 11.161: File Naming Conventions & Codebase Cleanup

## Status: Planning

## Overview

This epic addresses three related goals:

1. **Refactor**: Reorganize `language_configs/` by semantic role with call-graph-friendly handler architecture
2. **Cleanup**: Remove stale debug/temporary files from the codebase
3. **Enforcement**: Implement hook scripts to prevent future violations

## Background: The Call Graph Air-Gap Problem

The current handler system uses `Map<string, { process: ProcessFunction }>` with anonymous functions. This breaks call graph detection because:

1. **Anonymous functions** have no named symbol to track
2. **Dynamic dispatch** via string lookup is opaque to static analysis

### Solution: Named Handler Functions

Replace anonymous inline functions with named, exported handler functions:

```typescript
// Before: Anonymous (breaks call graph)
new Map([["definition.class", { process: (c, b, ctx) => { ... } }]])

// After: Named (call graph friendly)
export function handle_definition_class(c, b, ctx) { ... }
export const HANDLERS = { "definition.class": handle_definition_class }
```

The string-based dispatch is unavoidable (inherent to tree-sitter's `.scm` capture system), but named functions make everything else traceable.

## Target Directory Structure

```
query_code_tree/
├── capture_handlers/           # Capture name → handler mappings
│   ├── types.ts
│   ├── index.ts
│   ├── javascript.ts
│   ├── typescript.ts
│   ├── python.ts
│   └── rust.ts
│
├── metadata_extractors/        # AST → semantic info extraction
│   ├── types.ts
│   ├── index.ts
│   ├── javascript.ts
│   ├── typescript.ts
│   ├── python.ts
│   └── rust.ts
│
├── symbol_factories/           # SymbolId creation helpers
│   ├── types.ts
│   ├── index.ts
│   ├── javascript.ts
│   ├── typescript.ts
│   ├── python.ts
│   └── rust.ts
│
└── queries/                    # .scm files (unchanged)
```

## Subtasks

### Task 11.161.1: Reorganize language_configs by Semantic Role

Split `language_configs/` into semantic role directories with named handler functions.

- 11.161.1.1: Create semantic role directory structure
- 11.161.1.2: Extract named handler functions (JavaScript)
- 11.161.1.3: Extract named handler functions (TypeScript)
- 11.161.1.4: Extract named handler functions (Python)
- 11.161.1.5: Extract named handler functions (Rust)
- 11.161.1.6: Migrate metadata extractors
- 11.161.1.7: Migrate symbol factories
- 11.161.1.8: Update imports and delete old files

### Task 11.161.2: Fix Other File Naming Violations

- 11.161.2.1: Rename test files to convention
- 11.161.2.2: Document scopes/extractors/ as exception

### Task 11.161.3: Delete Stale Debug Files

- 11.161.3.1: Delete root debug scripts
- 11.161.3.2: Delete root one-off scripts
- 11.161.3.3: Delete root report files
- 11.161.3.4: Delete log files and package violations

### Task 11.161.4: Implement Hook Enforcement

- 11.161.4.1: Create PreToolUse file naming validator
- 11.161.4.2: Create Stop hook file auditor
- 11.161.4.3: Wire hooks into settings
- 11.161.4.4: Test hook behavior

### Task 11.161.5: Update Documentation

- 11.161.5.1: Finalize file-naming-conventions.md
- 11.161.5.2: Update CLAUDE.md

## Root Directory Whitelist

Files allowed in root:

```
package.json, package-lock.json, tsconfig.json, tsconfig.tsbuildinfo
eslint.config.js, .gitignore, .npmrc, .npmignore, LICENSE
README.md, CONTRIBUTING.md, CLAUDE.md, AGENTS.md, .cursorrules
```

## False Positive Groups Addressed

This task addresses the following false positive group from `top-level-nodes-analysis/results/false_positive_groups.json`:

- **anonymous-function-body-calls-not-tracked** (21 entries)
  - Root cause: Calls from within anonymous arrow function bodies not tracked
  - Solution: Extract anonymous handlers into named, exported functions

## Dependencies

- None (standalone refactoring epic)

## Success Criteria

1. All handlers are named, exported functions
2. No stale debug/temp files in repository
3. Hooks prevent creation of prohibited files
4. All tests pass
5. Documentation updated
