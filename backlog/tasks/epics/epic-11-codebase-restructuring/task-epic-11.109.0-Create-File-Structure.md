# Task 11.109.0: Create File Structure and Shared Types

**Status:** Not Started
**Priority:** Critical
**Estimated Effort:** 1 day
**Parent:** task-epic-11.109
**Dependencies:** None

## Objective

Create the folder structure and shared type definitions for the scope-aware symbol resolution system. This establishes the architecture before implementation begins.

## File Structure to Create

```
packages/core/src/resolve_references/
├── scope_resolver_index/
│   ├── scope_resolver_index.ts       # Created by 11.109.1
│   └── scope_resolver_index.test.ts
├── resolution_cache/
│   ├── resolution_cache.ts           # Created by 11.109.2
│   └── resolution_cache.test.ts
├── import_resolution/
│   ├── import_resolver.ts            # Created by 11.109.3 (main logic + export chain)
│   ├── import_resolver.test.ts
│   ├── import_resolver.javascript.ts # Created by 11.109.3 (JS module resolution)
│   ├── import_resolver.javascript.test.ts
│   ├── import_resolver.typescript.ts # Created by 11.109.3 (TS module resolution)
│   ├── import_resolver.typescript.test.ts
│   ├── import_resolver.python.ts     # Created by 11.109.3 (Python module resolution)
│   ├── import_resolver.python.test.ts
│   ├── import_resolver.rust.ts       # Created by 11.109.3 (Rust module resolution)
│   └── import_resolver.rust.test.ts
├── type_resolution/
│   ├── type_context.ts               # Created by 11.109.4
│   └── type_context.test.ts
├── call_resolution/
│   ├── function_resolver.ts          # Created by 11.109.5
│   ├── function_resolver.test.ts
│   ├── method_resolver.ts            # Created by 11.109.6
│   ├── method_resolver.test.ts
│   ├── constructor_resolver.ts       # Created by 11.109.7
│   └── constructor_resolver.test.ts
├── symbol_resolution.ts              # Created by 11.109.8
├── index.ts                          # Created by 11.109.8
└── types.ts                          # Created by THIS TASK (shared types)
```

## Implementation Steps

### 1. Create Directory Structure

```bash
mkdir -p packages/core/src/resolve_references/scope_resolver_index
mkdir -p packages/core/src/resolve_references/resolution_cache
mkdir -p packages/core/src/resolve_references/import_resolution
mkdir -p packages/core/src/resolve_references/type_resolution
mkdir -p packages/core/src/resolve_references/call_resolution
```

### 2. Create Shared Types File

**File:** `packages/core/src/resolve_references/types.ts`

```typescript
/**
 * Shared types for scope-aware symbol resolution
 */

import type { SymbolId, SymbolName, ScopeId, FilePath } from "@ariadnejs/types";

/**
 * Resolver function type - returns symbol_id or null
 *
 * These are lightweight closures that perform resolution on-demand.
 * They capture just enough context to resolve a symbol when called.
 */
export type SymbolResolver = () => SymbolId | null;

/**
 * Import specification extracted from ImportDefinition
 * Used to create lazy import resolver functions
 */
export interface ImportSpec {
  local_name: SymbolName;      // Name used in importing file
  source_file: FilePath;       // Resolved target file path
  import_name: SymbolName;     // Name to look up in source file
  import_kind: "named" | "default" | "namespace";
}

/**
 * Export information found in a file
 * Used during import resolution chain following
 */
export interface ExportInfo {
  symbol_id: SymbolId;
  is_reexport: boolean;
  source_file?: FilePath;      // Set if this is a re-export
  source_name?: SymbolName;    // Set if this is a re-export
}
```

### 3. Create Placeholder README

**File:** `packages/core/src/resolve_references/README.md`

```markdown
# Symbol Resolution System

On-demand scope-aware resolution of all function, method, and constructor calls using resolver functions and caching.

## Architecture

See task-epic-11.109 for complete architecture documentation.

## Directory Structure

- `scope_resolver_index/` - Core resolver index that maps scopes to resolver functions
- `resolution_cache/` - Shared cache for all symbol resolutions
- `import_resolution/` - Lazy import resolution with export chain following
- `type_resolution/` - Type tracking and member lookup
- `call_resolution/` - Function, method, and constructor call resolvers
- `symbol_resolution.ts` - Main orchestration pipeline
- `index.ts` - Public API exports
- `types.ts` - Shared type definitions

## Implementation Order

1. Task 11.109.0 - Create file structure (this task)
2. Task 11.109.1 - Scope resolver index
3. Task 11.109.2 - Resolution cache
4. Task 11.109.3 - Lazy import resolution
5. Task 11.109.4 - Type context
6. Task 11.109.5 - Function call resolution
7. Task 11.109.6 - Method call resolution
8. Task 11.109.7 - Constructor call resolution
9. Task 11.109.8 - Main orchestration
10. Task 11.109.9 - Testing
11. Task 11.109.10 - Cleanup
```

## Verification

After completing this task:

```bash
# Verify directory structure
ls -la packages/core/src/resolve_references/

# Should see:
# - scope_resolver_index/
# - resolution_cache/
# - import_resolution/
# - type_resolution/
# - call_resolution/
# - types.ts
# - README.md
```

## Success Criteria

- ✅ All directories created
- ✅ Shared types.ts file created with SymbolResolver and ImportSpec
- ✅ README.md created with architecture overview
- ✅ No implementation code yet (just structure)
- ✅ All paths follow pythonic naming (snake_case)

## Notes

This task creates ONLY the structure. No implementation code. Each subsequent task will create exactly one code file (plus its .test.ts file) in this structure.

## Dependencies

**Uses:** None

**Consumed by:**
- All tasks 11.109.1 through 11.109.10

## Next Steps

After completion:
- Task 11.109.1 can create scope_resolver_index.ts
- Task 11.109.2 can create resolution_cache.ts
- All other implementation tasks can proceed
