---
id: task-epic-11.67
title: Consolidate Types to @ariadnejs/types Package
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, types, refactoring, consolidation]
dependencies: []
parent_task_id: epic-11
---

## Description

Systematically migrate all type definitions to use the `@ariadnejs/types` package. Many modules still have local type definitions that should be shared, and some modules aren't using the types package at all. This creates inconsistency and duplication.

## Context

From recent refactoring:
- We moved types like ScopeTree, FunctionCallInfo, MethodCallInfo to @ariadnejs/types
- Many modules still define their own types locally
- Some modules have Def placeholder interfaces
- Need consistent type usage across all modules

## Current State Analysis

### Modules Using Local Types (Should Migrate):
- Various modules have local `Def` interfaces
- Context interfaces mixed between local and shared
- Some modules duplicate types that exist in @ariadnejs/types

### Missing from @ariadnejs/types:
- `Def` - Definition type used across many modules
- `ClassHierarchy` - Used by inheritance modules
- `ModuleGraph` - Used by import/export modules
- `TypeFlowGraph` - Needed for type propagation
- Language-specific AST pattern types

## Acceptance Criteria

### Phase 1: Audit Current Type Usage
- [ ] List all modules importing from @ariadnejs/types
- [ ] List all modules with local type definitions
- [ ] Identify duplicate type definitions
- [ ] Document which types should be public vs internal

### Phase 2: Add Missing Core Types
- [ ] Add `Def` interface to @ariadnejs/types:
  ```typescript
  export interface Def {
    name: string;
    kind: 'function' | 'class' | 'variable' | 'type';
    location: Location;
    file_path: string;
    language: Language;
  }
  ```
- [ ] Add `ClassHierarchy` interface
- [ ] Add `ModuleGraph` interface
- [ ] Add `TypeFlowGraph` interface
- [ ] Add other missing shared types

### Phase 3: Migrate Existing Modules

**High-Priority Modules:**
- [ ] `/type_analysis/type_tracking/` - Remove local types
- [ ] `/call_graph/method_calls/` - Use shared Def
- [ ] `/call_graph/function_calls/` - Use shared types
- [ ] `/call_graph/constructor_calls/` - Ensure all shared
- [ ] `/inheritance/class_hierarchy/` - Use shared ClassHierarchy
- [ ] `/import_export/module_graph/` - Use shared ModuleGraph

**Module Categories to Check:**
- [ ] All `/call_graph/*` modules
- [ ] All `/type_analysis/*` modules  
- [ ] All `/scope_analysis/*` modules
- [ ] All `/inheritance/*` modules
- [ ] All `/import_export/*` modules

### Phase 4: Establish Type Guidelines
- [ ] Document when to use @ariadnejs/types vs local types
- [ ] Create type naming conventions
- [ ] Define public API surface
- [ ] Document type versioning strategy

### Phase 5: Clean Up
- [ ] Remove all duplicate type definitions
- [ ] Remove placeholder types (local Def, etc.)
- [ ] Ensure no circular dependencies
- [ ] Update all imports to use @ariadnejs/types

### Phase 6: Type Contracts
- [ ] Ensure all public functions use types from @ariadnejs/types
- [ ] Internal/private functions can use local types
- [ ] Context interfaces with AST should stay local
- [ ] Add JSDoc comments to all exported types

## Implementation Strategy

### What Goes in @ariadnejs/types:
- Types used across module boundaries
- Types that are part of the public API
- Types returned by public functions
- Core domain types (Def, Location, etc.)

### What Stays Local:
- Implementation details
- Context interfaces with tree-sitter AST
- Private helper types
- Test-only types

### Migration Process per Module:
1. Identify all type imports and exports
2. Check if types exist in @ariadnejs/types
3. If not, determine if they should be shared
4. Add to @ariadnejs/types if needed
5. Update imports
6. Remove local definitions
7. Run tests

### Example Migration:

**Before:**
```typescript
// In method_calls.ts
interface Def {
  name: string;
  // ...
}

interface MethodCallContext {
  ast: SyntaxNode; // Local - contains AST
  // ...
}

export function find_method_calls(): MethodCallInfo[] {
  // MethodCallInfo is already in @ariadnejs/types
}
```

**After:**
```typescript
// In method_calls.ts
import { Def, MethodCallInfo } from '@ariadnejs/types';

interface MethodCallContext {
  ast: SyntaxNode; // Stays local - implementation detail
  // ...
}

export function find_method_calls(): MethodCallInfo[] {
  // Uses shared types
}
```

## Type Organization in @ariadnejs/types

Suggested structure:
```
@ariadnejs/types/
  ├── index.ts       # Re-exports all public types
  ├── common.ts      # Location, Language, etc.
  ├── definitions.ts # Def, ClassDef, FunctionDef
  ├── calls.ts       # *CallInfo types
  ├── scopes.ts      # ScopeTree, ScopeNode
  ├── types.ts       # TypeInfo, TypeRegistry
  ├── modules.ts     # ImportInfo, ExportInfo, ModuleGraph
  └── analysis.ts    # FileAnalysis, CodeGraph
```

## Success Metrics
- Zero duplicate type definitions
- All public APIs use @ariadnejs/types
- No circular dependencies
- All modules compile without type errors
- Cleaner, more maintainable codebase

## Benefits
- Single source of truth for types
- Better type safety across modules
- Easier to maintain and evolve types
- Clear API boundaries
- Better IDE support and autocomplete

## References
- Types package: `/packages/types/src/`
- Recent migration examples:
  - ScopeTree migration (moved to types/scopes.ts)
  - CallInfo types migration (moved to types/calls.ts)
- Modules needing attention:
  - All files with "TODO: Use types from @ariadnejs/types"
  - All files with local Def interfaces

## Notes
This is a refactoring task that improves code quality without changing functionality. Should be done incrementally to avoid breaking changes. Each module migration can be a small PR.