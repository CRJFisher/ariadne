# Task: Separate Single-File from Cross-File Type Processing

**Task ID**: task-epic-11.90
**Parent**: epic-11-codebase-restructuring
**Status**: Created
**Priority**: Critical
**Created**: 2024-01-19
**Estimated Effort**: 5-7 days

## Problem Statement

Multiple type-related modules in `semantic_index` are attempting cross-file resolution before symbol resolution has occurred, creating architectural violations and circular dependencies:

1. **type_members**: Trying to resolve inherited members from imported base classes
2. **type_registry**: Attempting to maintain global type registry during single-file analysis
3. **type_resolution**: Performing resolution work in extraction phase
4. **type_tracking**: Tracking types through unresolved imports
5. **type_flow_references**: Resolving constructor types before class definitions are available
6. **type_annotation_references**: Building type hierarchies and resolving generics before imports

These modules violate the fundamental principle: **semantic_index = single-file analysis, symbol_resolution = cross-file linking**.

## Solution Overview

Restructure type processing to strictly follow the phase-based architecture:

### Phase Separation

- **Semantic Index**: Extract only local, single-file type information
- **Symbol Resolution Phase 3**: Perform all cross-file type resolution after imports and functions are resolved

### Key Principle

- TypeIds can only be generated in symbol_resolution (need definition locations)
- Inheritance can only be resolved after imports are resolved
- Type flow through functions requires resolved function signatures

## Implementation Plan

### 1. Module Migration Overview

#### Modules to Move Entirely

- `semantic_index/type_registry/` → `symbol_resolution/type_resolution/type_registry/`
- `semantic_index/type_resolution/` → `symbol_resolution/type_resolution/`

#### Modules to Split

- `semantic_index/type_members/` → Split local vs inherited member extraction
- `semantic_index/references/type_tracking/` → Split annotation extraction vs resolution
- `semantic_index/references/type_flow_references/` → Split flow tracking vs type resolution
- `semantic_index/references/type_annotation_references/` → Split syntax extraction vs type resolution

### 2. New Architecture

```
semantic_index/
├── local_types/              # Single-file type extraction only
│   ├── extract_members.ts    # Direct members only
│   ├── extract_annotations.ts # Type annotations as strings
│   └── extract_flows.ts      # Assignment patterns
│
symbol_resolution/
└── type_resolution/          # Phase 3 - All cross-file type work
    ├── type_registry.ts      # Global TypeId registry
    ├── resolve_members.ts    # Complete member resolution with inheritance
    ├── resolve_annotations.ts # Resolve type strings to TypeIds
    ├── type_flow.ts          # Track types through resolved functions
    └── inheritance.ts        # Resolve inheritance chains
```

## Subtasks

### Phase 1: Prepare Infrastructure

**Task ID**: task-epic-11.90.1

- Create `symbol_resolution/type_resolution/` directory structure
- Define interfaces for local vs resolved type information
- Create type resolution test fixtures
- Set up module exports and imports

### Phase 2: Type Members Module Split

**Task ID**: task-epic-11.90.2

- Simplify `type_members` to extract only direct members
- Remove inheritance resolution from `type_members`
- Create `symbol_resolution/type_resolution/resolve_members.ts`
- Implement inheritance chain resolution in symbol_resolution
- Update type_members tests for local-only extraction

### Phase 3: Type Registry Migration

**Task ID**: task-epic-11.90.3

- Move type_registry to symbol_resolution
- Remove TypeId generation from semantic_index
- Implement TypeId generation in Phase 3
- Update all type_registry imports
- Create global type registry tests

### Phase 4: Type Resolution Migration

**Task ID**: task-epic-11.90.4

- Move type_resolution module to symbol_resolution
- Integrate with Phase 3 pipeline
- Remove type_resolution from semantic_index
- Update all imports and dependencies

### Phase 5: Type Tracking Split

**Task ID**: task-epic-11.90.5

- Simplify type_tracking to annotation extraction only
- Remove TypeInfo resolution logic
- Create annotation resolution in symbol_resolution
- Update type_tracking tests

### Phase 6: Type Flow References Split

**Task ID**: task-epic-11.90.6

- Simplify type_flow to assignment tracking only
- Remove constructor type resolution
- Create type flow analysis in symbol_resolution
- Update type_flow tests

### Phase 7: Type Annotation References Split

**Task ID**: task-epic-11.90.7

- Simplify type_annotation_references to syntax extraction only
- Remove TypeInfo creation and hierarchy building
- Extract generic syntax without resolution
- Create annotation resolution in symbol_resolution
- Update type_annotation_references tests

### Phase 8: Integration

**Task ID**: task-epic-11.90.8

- Wire type resolution into symbol_resolution Phase 3
- Update SemanticIndex interface
- Integration testing across all phases
- Performance benchmarking
- Documentation updates

## Success Criteria

1. **Clean Phase Separation**: No semantic_index module attempts cross-file resolution
2. **TypeId Generation**: Only happens in symbol_resolution with full context
3. **Inheritance Resolution**: Works correctly across file boundaries
4. **Type Flow Tracking**: Accurately tracks types through resolved function calls
5. **No Circular Dependencies**: Clear unidirectional flow from extraction to resolution
6. **Test Coverage**: All modules have comprehensive tests for their specific responsibilities

## Technical Details

### LocalTypeInfo (semantic_index)

```typescript
interface LocalTypeInfo {
  readonly type_name: SymbolName;
  readonly kind: "class" | "interface" | "type" | "enum";
  readonly location: Location;
  readonly direct_members: Map<SymbolName, MemberInfo>;
  readonly extends_clause?: SymbolName[]; // Just names
  readonly implements_clause?: SymbolName[]; // Just names
}
```

### ResolvedTypeInfo (symbol_resolution)

```typescript
interface ResolvedTypeInfo {
  readonly type_id: TypeId;
  readonly definition_location: Location;
  readonly all_members: Map<SymbolName, MemberInfo>; // Including inherited
  readonly base_types: TypeId[]; // Resolved bases
  readonly derived_types: TypeId[]; // Known derivations
  readonly constructor?: SymbolId;
}
```

## Dependencies

- Depends on: TypeId removal from TypeInfo (completed)
- Blocks: Method call resolution accuracy
- Related: Import/export resolution must be complete

## Risks and Mitigations

### Risk 1: Breaking Existing Functionality

**Mitigation**: Implement parallel to existing, switch over when complete

### Risk 2: Performance Regression

**Mitigation**: Benchmark before/after, optimize Phase 3 if needed

### Risk 3: Complex Migration Path

**Mitigation**: Migrate one module at a time with tests passing

## Notes

- This refactoring is critical for correct method resolution
- Will enable proper TypeScript/Python type checking
- Fixes fundamental architectural violations
- Enables future optimizations (parallel semantic indexing)

## References

- Original architecture document
- Symbol resolution pipeline design
- TypeId design rationale
