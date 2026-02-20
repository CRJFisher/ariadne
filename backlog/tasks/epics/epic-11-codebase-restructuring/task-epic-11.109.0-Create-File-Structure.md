# Task 11.109.0: Create File Structure and Shared Types

**Status:** Completed
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

## Implementation Notes

**Completed:** 2025-10-02
**TypeScript Compilation:** ✅ Passed (npm run typecheck)

### What Was Completed

1. **Directory Structure Created:**
   - `packages/core/src/resolve_references/scope_resolver_index/` - Will contain core resolver index (task 11.109.1)
   - `packages/core/src/resolve_references/resolution_cache/` - Will contain caching layer (task 11.109.2)
   - `packages/core/src/resolve_references/import_resolution/` - Will contain lazy import resolution (task 11.109.3)
   - `packages/core/src/resolve_references/type_resolution/` - Will contain type tracking (task 11.109.4)
   - `packages/core/src/resolve_references/call_resolution/` - Will contain function/method/constructor resolvers (tasks 11.109.5-7)

2. **Shared Types File:** `packages/core/src/resolve_references/types.ts`
   ```typescript
   export type SymbolResolver = () => SymbolId | null;
   export interface ImportSpec { local_name, source_file, import_name, import_kind }
   export interface ExportInfo { symbol_id, is_reexport, source_file?, source_name? }
   ```

3. **Documentation:** `packages/core/src/resolve_references/README.md`
   - Architecture overview with clear module boundaries
   - Directory structure documentation
   - Implementation order for tasks 11.109.0 through 11.109.10

### Architectural Decisions

1. **Modular Directory Structure:**
   - Separated concerns into distinct directories (scope resolution, caching, import resolution, type resolution, call resolution)
   - Each directory will contain self-contained modules with their own test files
   - Follows single-responsibility principle for maintainability

2. **Shared Types Design:**
   - Created centralized `types.ts` to avoid circular dependencies
   - All modules will import shared types from single source
   - Types are minimal and focused on inter-module contracts

3. **Naming Conventions:**
   - All directories use pythonic `snake_case` naming
   - Consistent with project guidelines in CLAUDE.md
   - Makes module names predictable and discoverable

4. **Resolver Function Pattern:**
   - `SymbolResolver` type defined as zero-argument closure returning `SymbolId | null`
   - Enables lazy evaluation of symbol resolution
   - Allows resolvers to capture minimal context as closures
   - Defers expensive lookups until actually needed

### Design Patterns Discovered

1. **Closure-Based Resolution:**
   - `SymbolResolver` embodies the Command pattern as a lightweight closure
   - Each resolver encapsulates the "how" of resolution without exposing implementation
   - Enables composition and chaining of resolvers

2. **Lazy Evaluation:**
   - Import resolution deferred via `ImportSpec` interface
   - Resolution only happens when resolver is invoked
   - Supports incremental/on-demand resolution strategy

3. **Chain of Responsibility:**
   - `ExportInfo` designed to support re-export chain following
   - `is_reexport` flag enables recursive traversal
   - `source_file` and `source_name` provide next link in chain

### Performance Characteristics

1. **Memory:**
   - Minimal footprint - only directory structure and type definitions
   - No runtime overhead yet (no implementation code)
   - Future resolver closures will capture only necessary context

2. **Compilation:**
   - TypeScript compilation successful with no errors
   - Type definitions compile cleanly against `@ariadnejs/types`
   - No circular dependency issues

3. **Scalability Considerations:**
   - Modular structure allows parallel implementation of different resolvers
   - Separation of concerns enables independent optimization of each module
   - Cache directory dedicated to performance optimization

### Issues Encountered

**None.** Task completed without issues:
- All directories created successfully
- TypeScript types compile cleanly
- All imports from `@ariadnejs/types` valid
- Naming conventions followed correctly

### Verification Performed

1. **Directory Structure:**
   ```bash
   ls -la packages/core/src/resolve_references/
   # Verified: 5 directories + types.ts + README.md + existing index.ts
   ```

2. **TypeScript Compilation:**
   ```bash
   npm run typecheck
   # Passed: All packages compile without errors
   ```

3. **Type Imports:**
   - Verified `SymbolId`, `SymbolName`, `ScopeId`, `FilePath` from `@ariadnejs/types`
   - All type references resolve correctly

### Follow-on Work Needed

**Immediate Next Steps:**
1. **Task 11.109.1** - Implement `scope_resolver_index/scope_resolver_index.ts`
   - Core data structure mapping scopes to resolver functions
   - Foundation for all subsequent resolution logic

2. **Task 11.109.2** - Implement `resolution_cache/resolution_cache.ts`
   - Caching layer to avoid redundant resolutions
   - Performance optimization for repeated lookups

3. **Task 11.109.3** - Implement `import_resolution/import_resolver.ts` + language-specific resolvers
   - Lazy import resolution with export chain following
   - Language-specific module resolution (JS/TS/Python/Rust)

**Future Considerations:**
- Consider adding `ResolverOptions` type if configuration becomes needed
- May need `ResolverContext` type for passing shared state
- Potential for `ResolverFactory` pattern if resolver creation becomes complex

### Testing Status

- ✅ TypeScript compilation verified
- ⏸️ No runtime tests yet (structure only, no implementation)
- ⏸️ Unit tests will be created with each subsequent implementation task

### Dependencies Status

**Upstream Dependencies:** None (foundational task)

**Downstream Consumers (blocked until this completes):**
- ✅ Task 11.109.1 - Scope resolver index (unblocked)
- ✅ Task 11.109.2 - Resolution cache (unblocked)
- ✅ Task 11.109.3 - Import resolution (unblocked)
- ✅ Task 11.109.4 - Type resolution (unblocked)
- ✅ Task 11.109.5-7 - Call resolvers (unblocked)
- ✅ Task 11.109.8 - Main orchestration (unblocked)

### Alignment with Intention Tree

This task establishes the structural foundation for the resolve_references module, which serves the top-level intention:
- **Top-level goal:** Detect call graphs to find codebase entry points
- **This module's role:** Resolve references to symbols (matching symbol-names to symbol-ids)
- **Implementation approach:** Scope-aware, on-demand resolution using resolver functions

The modular structure reflects the decomposition of reference resolution into:
1. Scope management (scope_resolver_index)
2. Performance optimization (resolution_cache)
3. Cross-file resolution (import_resolution)
4. Type-aware resolution (type_resolution)
5. Call-specific resolution (call_resolution)

Each directory represents a focused responsibility in the resolution pipeline, avoiding "extra" functionality outside the intention tree.
