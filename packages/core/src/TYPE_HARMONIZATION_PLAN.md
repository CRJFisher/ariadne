# Type Harmonization Plan - Task 11.52

## Executive Summary

This document analyzes the type overlap between `packages/types` and `packages/core/src/code_graph.ts`, proposing a harmonization strategy to establish clear boundaries between public API types and internal implementation types.

## Current State Analysis

### Types in `@ariadnejs/types` (packages/types/src/)

**Core Types:**

- `Language` - language enumeration
- `Point`, `Range` - location primitives
- `Scoping` - scope enumeration
- `Edit` - tree-sitter edit type

**Graph Node Types (Old Architecture):**

- `BaseNode`, `Def`, `Ref`, `Import`, `Scope` - node variants
- `Node` - union type
- `SymbolKind` - symbol type enumeration

**Graph Edge Types (Old Architecture):**

- `BaseEdge`, `DefToScope`, `RefToDef`, etc.
- `Edge` - union type

**Call Graph Types (Mixed Old/New):**

- `Call`, `CallGraphNode`, `CallGraphEdge`, `CallGraph`
- `FunctionCall`, `ImportInfo`
- `CallGraphOptions`

**Interface Types:**

- `IScopeGraph` - scope graph interface
- `FunctionMetadata`, `ExtractedContext`

### Types in `code_graph.ts` (New Architecture)

**Core Location Types:**

- `Location` - ⚠️ OVERLAP with Point/Range

**File Analysis Types:**

- `FileAnalysis` - per-file results
- `FunctionInfo`, `ClassInfo` - extracted entities
- `MethodInfo`, `PropertyInfo` - class members
- `FunctionSignature`, `ParameterType`, `TypeParameter` - signatures

**Graph Structure Types:**

- `CodeGraph` - main output structure
- `CodeGraphOptions` - API options

**Call Graph Types:**

- `CallGraph` - ⚠️ CONFLICT with types package
- `FunctionNode`, `CallEdge` - call graph elements
- `ResolvedCall`, `CallChain` - enhanced call info

**Type System Types:**

- `TypeIndex`, `VariableType`, `TypeDefinition`
- `TypeGraph`, `TypeEdge`

**Symbol Index Types:**

- `SymbolIndex`, `Definition`, `Usage`
- `ExportedSymbol`, `ResolvedSymbol`

**Class Hierarchy Types:**

- `ClassHierarchy` - inheritance structure

## Conflicts and Overlaps

### 1. Direct Conflicts

- **`CallGraph`** - Different definitions in both packages
  - types: Has `nodes: Map<string, CallGraphNode>`, uses old node structure
  - code_graph: Has `functions: Map<string, FunctionNode>`, new structure
- **Location types** - `Point/Range` vs `Location`

### 2. Semantic Overlaps

- **`Def` vs `Definition`** - Both represent definitions
- **`Ref` vs `Usage`** - Both represent references/usages
- **`FunctionCall` vs `CallEdge`** - Both represent function calls
- **`Import` vs `ImportInfo`** - Import representations

### 3. Architectural Mismatches

- types package has old graph-node-based architecture
- code_graph has new specialized structure architecture

## Harmonization Strategy

### Phase 1: Establish Clear Boundaries

**Public API Types (Move to @ariadnejs/types):**

```typescript
// Core structures returned by API
- CodeGraph
- CodeGraphOptions
- FileAnalysis
- CallGraph (new version)
- ModuleGraph
- ClassHierarchy
- TypeIndex
- SymbolIndex

// Common types used across API
- Location (harmonized Point/Range)
- FunctionInfo, ClassInfo
- FunctionNode, CallEdge
- Definition, Usage
- TypeDefinition
```

**Internal Implementation Types (Keep in core):**

```typescript
// Processing contexts
- *Context types
- *Config types

// Internal structures
- InternalFileAnalysis
- Builder types
- Helper types
```

### Phase 2: Migration Plan

#### Step 1: Prepare Types Package

1. Create new files in packages/types/src/:
   - `codegraph.ts` - Main CodeGraph types
   - `modules.ts` - ModuleGraph types
   - `calls.ts` - CallGraph types (new version)
   - `classes.ts` - ClassHierarchy types
   - `types.ts` - TypeIndex types
   - `symbols.ts` - SymbolIndex types
   - `common.ts` - Shared types (Location, etc.)

#### Step 2: Resolve Conflicts

1. **CallGraph Conflict:**
   - Rename old `CallGraph` to `LegacyCallGraph`
   - Use new `CallGraph` definition
2. **Location Harmonization:**

   ```typescript
   // Unified location type
   export interface Location {
     file_path?: string;
     line: number;
     column: number;
     end_line?: number;
     end_column?: number;
   }

   // Keep Point/Range for tree-sitter compatibility
   export interface Point {
     row: number;
     column: number;
   }
   ```

3. **Definition/Ref Harmonization:**
   - Keep `Def/Ref` for legacy IScopeGraph
   - Use `Definition/Usage` for new architecture
   - Add conversion utilities if needed

#### Step 3: Update Imports

1. Update code_graph.ts to import from @ariadnejs/types
2. Update all modules using these types
3. Remove duplicate type definitions

#### Step 4: Deprecate Legacy Types

1. Mark old graph-node types as @deprecated
2. Keep for backward compatibility
3. Plan removal in next major version

## Implementation Checklist

### Immediate Actions

- [ ] Create type organization structure in packages/types
- [ ] Copy CodeGraph types to packages/types
- [ ] Resolve CallGraph naming conflict
- [ ] Harmonize Location/Point/Range

### Migration Actions

- [ ] Update imports in code_graph.ts
- [ ] Update imports in graph_queries.ts
- [ ] Update imports in all analysis modules
- [ ] Add type-only exports to packages/types

### Validation Actions

- [ ] TypeScript compilation passes
- [ ] No circular dependencies
- [ ] All tests pass
- [ ] API surface is clear

## Benefits

1. **Clear API Boundaries** - Users know exactly what types are public
2. **No Duplication** - Single source of truth for types
3. **Better Versioning** - Type changes tracked in types package
4. **Easier Documentation** - All public types in one place
5. **Type Safety** - Consistent types across packages

## Risks and Mitigations

**Risk**: Breaking existing code using old types
**Mitigation**: Keep legacy types with @deprecated markers

**Risk**: Circular dependencies between packages
**Mitigation**: types package cannot import from core

**Risk**: Large migration effort
**Mitigation**: Incremental migration, type aliases for compatibility

## Recommendation

Proceed with the harmonization in this order:

1. First, organize and copy types (non-breaking)
2. Then, update imports module by module
3. Finally, deprecate old types (next release)

This approach minimizes disruption while establishing a clean type architecture for the future.
