---
id: task-epic-11.62
title: Wire Processing Layer Dependencies - CRITICAL INTEGRATION TASK
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, integration, architecture, critical, high-priority]
dependencies: [task-epic-11.60, task-epic-11.61]
parent_task_id: epic-11
---

## 🚨 CRITICAL IMPORTANCE 🚨

**This is THE most important integration task in Epic 11.** Without completing this, the entire processing pipeline remains broken. Modules work in isolation but cannot share data, making cross-file analysis impossible.

## Description

Wire up the proper dependencies between processing layers according to the architecture defined in PROCESSING_PIPELINE.md. Many modules have TODO comments for integrations but lack actual connections, causing incomplete analysis and broken cross-file resolution.

## Why This Is Critical

1. **Current State**: Modules are islands - they work internally but don't communicate
2. **Impact**: Cross-file analysis, type resolution, and method resolution are all broken
3. **Blocking**: This blocks virtually all advanced features of the codebase analysis

## Breaking This Down Into Sub-Tasks

Due to the complexity and critical nature, this task MUST be broken into smaller, manageable pieces:

### Sub-Task Structure

#### 11.62.1: Update Function Signatures (PREREQUISITES)

**Do First** - Update all function signatures to accept the data they need

- No implementation yet, just signatures
- Ensures type safety and clear contracts
- Makes dependencies explicit

#### 11.62.2: Implement Data Passing in code_graph.ts

**Do Second** - Update the orchestrator to actually pass data between layers

- Implement ProcessingContext accumulation
- Ensure data flows from layer to layer

#### 11.62.3-11.62.10: Individual Integration Tasks

**Do in parallel or sequence** - Each critical dependency gets its own sub-task

---

## Sub-Tasks

### task-epic-11.62.1: Update All Function Signatures

**Priority: CRITICAL - Do First**

Update function signatures across all modules to accept data from lower layers:

1. **Type Tracking** - Update to accept:

   ```typescript
   export function track_types(
     ast: SyntaxNode,
     scope_tree: ScopeTree, // NEW: From Layer 1
     imports: ImportInfo[], // NEW: From Layer 2
     class_definitions: ClassDefinition[], // NEW: From Layer 2
     source: string,
     language: Language
   ): TypeTrackingResult;
   ```

2. **Method Calls** - Update to accept:

   ```typescript
   export function find_method_calls(
     ast: SyntaxNode,
     type_tracker: TypeTracker, // NEW: From Layer 3
     class_hierarchy: ClassHierarchy, // NEW: From Layer 6
     source: string,
     language: Language
   ): MethodCallInfo[];
   ```

3. **Constructor Calls** - Update to accept:

   ```typescript
   export function find_constructor_calls(
     ast: SyntaxNode,
     type_registry: TypeRegistry, // NEW: From Layer 6
     source: string,
     language: Language
   ): ConstructorCallInfo[];
   ```

4. **Symbol Resolution** - Update to accept:
   ```typescript
   export function resolve_symbols(
     scope_tree: ScopeTree,
     imports: ImportInfo[], // NEW: No longer extracted internally
     module_graph: ModuleGraph, // NEW: From Layer 5
     source: string,
     language: Language
   ): ResolvedSymbols;
   ```

### task-epic-11.62.2: Implement ProcessingContext Pattern

**Priority: CRITICAL - Do Second**

Create and implement the ProcessingContext pattern to accumulate data:

```typescript
interface ProcessingContext {
  // Immutable, accumulated as we process
  readonly layer0: {
    ast: SyntaxNode;
    source: string;
    language: Language;
    file_path: string;
  };
  readonly layer1?: {
    scope_tree: ScopeTree;
    definitions: Definition[];
    usages: Usage[];
  };
  readonly layer2?: {
    imports: ImportInfo[];
    exports: ExportInfo[];
    classes: ClassDefinition[];
  };
  // ... etc
}
```

Update code_graph.ts to build and pass this context.

### task-epic-11.62.3: Wire Type Tracking to Import Resolution

**Dependency**: ImportInfo[] from import_resolution
**Current**: Has TODO but no actual code
**Impact**: Cannot track imported types

### task-epic-11.62.4: Wire Method Calls to Type Tracking

**Dependency**: TypeTracker from type_tracking
**Current**: Missing completely
**Impact**: Cannot resolve method receivers

### task-epic-11.62.5: Wire Method Calls to Class Hierarchy

**Dependency**: ClassHierarchy from class_hierarchy
**Current**: Missing completely
**Impact**: Cannot resolve virtual methods

### task-epic-11.62.6: Wire Constructor Calls to Type Registry

**Dependency**: TypeRegistry from type_registry
**Current**: Missing completely
**Impact**: Cannot validate constructor calls

### task-epic-11.62.7: Create Bidirectional Flow for Constructor→Type Updates

**Dependency**: Event system or callback pattern
**Current**: No mechanism exists
**Impact**: Type maps don't update after construction

### task-epic-11.62.8: Remove Import Extraction from Symbol Resolution

**Dependency**: ImportInfo[] from import_resolution
**Current**: Duplicates import extraction
**Impact**: Inconsistent import handling

### task-epic-11.62.9: Add Namespace Import Detection

**Dependency**: Enhanced ImportInfo with namespace support
**Current**: Namespace imports not properly detected
**Impact**: Cannot resolve namespace member access

### task-epic-11.62.10: Track Type-Only Imports

**Dependency**: Enhanced ImportInfo with type-only flag
**Current**: No distinction between runtime and type-only imports
**Impact**: Cannot optimize or handle circular type dependencies

---

## Success Metrics

- [ ] All function signatures updated to accept required dependencies
- [ ] ProcessingContext pattern implemented and used throughout
- [ ] All 6 critical dependencies wired and working
- [ ] Cross-file type resolution works
- [ ] Method calls resolve through inheritance
- [ ] No duplicate functionality between modules
- [ ] All integration tests pass

## Testing Strategy

1. **Unit Tests**: Each module works with mock dependencies
2. **Integration Tests**: Data flows correctly between layers
3. **End-to-End Tests**: Complete analysis of multi-file project works

## Order of Implementation

```
1. Update all function signatures (11.62.1) - Type safety first
2. Implement ProcessingContext (11.62.2) - Infrastructure
3. Wire individual dependencies (11.62.3-8) - Can be parallel
4. Integration testing - Verify everything works together
```

## Notes

- This task is the lynchpin of the entire architecture
- Without this, we have working parts but no working system
- Consider pair programming or extra review for this critical work
- Each sub-task should have its own tests

## References

- Processing pipeline: `/docs/PROCESSING_PIPELINE.md`
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md`
- Layer interfaces: `/packages/core/LAYER_INTERFACES.md`
