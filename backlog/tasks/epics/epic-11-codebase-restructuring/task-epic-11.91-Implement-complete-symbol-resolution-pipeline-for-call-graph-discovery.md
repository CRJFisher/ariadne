# Task: Implement Complete Symbol Resolution Pipeline for Call Graph Discovery

**Task ID**: task-epic-11.91
**Parent**: epic-11-codebase-restructuring
**Status**: Created
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 6-8 days

## Problem Statement

Following the successful completion of task-epic-11.90 (type processing separation), the symbol resolution pipeline now has Phase 3 (Type Resolution) fully implemented. However, Phases 1 and 2 remain unimplemented, preventing complete call graph discovery.

### Current State Analysis

**Implemented Components**:
- ✅ **Phase 3: Type Resolution** - Complete with type_resolution modules
- ✅ **Phase 4: Method/Constructor Resolution** - Basic implementation depends on Phases 1-2
- ✅ **Call Data Extraction** - semantic_index extracts CallReference, MemberAccessReference
- ✅ **Type Members Resolution** - Cross-file inheritance and member resolution

**Missing Components**:
- ❌ **Phase 1: Import/Export Resolution** - Critical for cross-file symbol mapping
- ❌ **Phase 2: Function Call Resolution** - Required for direct function calls
- ❌ **Call Graph Generation** - Transform resolved data into queryable call graphs
- ❌ **Call Graph Query API** - Developer-friendly interfaces for call graph analysis

### Call Graph Discovery Requirements

To enable comprehensive call graph discovery, we need:

1. **Import Resolution**: Map imported symbols to their source definitions
2. **Function Call Resolution**: Resolve function calls via lexical scoping
3. **Method Call Resolution**: Resolve method calls using type information
4. **Constructor Call Resolution**: Resolve constructor invocations
5. **Call Graph Construction**: Build directed graphs from resolved call data
6. **Query Interface**: Provide APIs for traversing and analyzing call relationships

## Solution Overview

Implement the remaining phases of the symbol resolution pipeline and build call graph construction on top of the resolved symbol mappings.

**Note**: This task originally included 6 subtasks but was reduced to 5 by removing the separate call graph query API task and integrating query functionality into the call graph construction system.

### Architecture Overview

```
semantic_index/               # Single-file extraction (✅ Complete)
├── call_references/          # Extract call information
├── member_access_references/ # Extract method access patterns
└── type_flow_references/     # Extract constructor calls

symbol_resolution/            # Cross-file resolution
├── phase1_import_resolution/ # ❌ Import/export mapping
├── phase2_function_resolution/ # ❌ Function call resolution
├── phase3_type_resolution/   # ✅ Type tracking & resolution
├── phase4_method_resolution/ # ⚠️ Depends on phases 1-2
└── call_graph/              # ❌ Call graph construction & queries
```

### Key Technical Challenges

1. **Import Path Resolution**: Handle relative/absolute imports, node_modules, package.json
2. **Lexical Scope Resolution**: Walk scope chains for function call resolution
3. **Hoisting Semantics**: Handle JavaScript/TypeScript var/function hoisting
4. **Type-Based Method Resolution**: Use resolved types to determine method targets
5. **Call Graph Performance**: Efficient data structures for large codebases

## Implementation Plan

### Phase 1: Import Resolution Infrastructure

**Task ID**: task-epic-11.91.1

- Create `symbol_resolution/import_resolution/` module
- Implement module path resolution (relative, absolute, node_modules)
- Handle named, default, and namespace imports
- Build import mapping: `file_path -> imported_name -> source_symbol_id`
- Support JavaScript, TypeScript, Python, Rust import patterns

### Phase 2: Function Call Resolution

**Task ID**: task-epic-11.91.2

- Create `symbol_resolution/function_resolution/` module
- Implement lexical scope walking for function resolution
- Handle JavaScript/TypeScript hoisting semantics
- Integrate with import resolution for cross-file function calls
- Build function call mapping: `call_location -> function_symbol_id`

### Phase 3: Enhanced Method Resolution

**Task ID**: task-epic-11.91.3

- Enhance Phase 4 method resolution using resolved imports and functions
- Improve type-based method lookup with inheritance chains
- Handle static vs instance method resolution
- Support method overloading and polymorphism
- Integrate constructor call resolution with type system

### Phase 4: Call Graph Construction

**Task ID**: task-epic-11.91.4

- Create `symbol_resolution/call_graph/` module
- Design efficient call graph data structures
- Build call graphs from resolved symbol mappings
- Support different graph types (function calls, method calls, combined)
- Implement graph serialization and caching

### Phase 5: Integration and Testing

**Task ID**: task-epic-11.91.5

- Comprehensive integration testing across all phases
- Performance benchmarking on large codebases
- Cross-language call graph validation
- Documentation and examples
- API documentation for call graph queries

## Success Criteria

1. **Complete Pipeline**: All 4 symbol resolution phases implemented and working
2. **Accurate Call Resolution**: Function, method, and constructor calls correctly resolved
3. **Cross-File Support**: Call graphs work across module boundaries
4. **Multi-Language**: Support for JavaScript, TypeScript, Python, Rust
5. **Performance**: Handle codebases with 10,000+ files efficiently
6. **Test Coverage**: Comprehensive tests for all resolution phases

## Technical Specifications

**⚠️ Critical Implementation Note**: All resolution maps using `Location` as keys must use `LocationKey` instead, since JavaScript Map equality is tested by reference, not value. The codebase provides `location_key(location: Location): LocationKey` for this purpose.

### Import Resolution Output

```typescript
interface ImportResolutionMap {
  // file_path -> (imported_name -> resolved_symbol_id)
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}
```

### Function Resolution Output

```typescript
interface FunctionResolutionMap {
  // call_location_key -> resolved_function_symbol_id
  readonly function_calls: ReadonlyMap<LocationKey, SymbolId>;
  // function_symbol_id -> call_site_locations
  readonly calls_to_function: ReadonlyMap<SymbolId, readonly Location[]>;
}
```

### Call Graph Structure

```typescript
interface CallGraph {
  // All resolved call relationships
  readonly call_edges: ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;
  // Reverse mapping for efficient queries
  readonly called_by: ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;
  // Call sites for detailed analysis
  readonly call_sites: ReadonlyMap<SymbolId, ReadonlyMap<SymbolId, readonly Location[]>>;
}
```

## Dependencies

- **Prerequisite**: task-epic-11.90 (Type processing separation) - ✅ Complete
- **Blocks**: Call graph analysis features, IDE integration
- **Related**: AST query optimization, incremental analysis

## Risks and Mitigations

### Risk 1: Import Resolution Complexity

JavaScript/TypeScript module resolution is complex (package.json, node_modules, path mapping).

**Mitigation**: Start with simple relative/absolute imports, add complexity incrementally.

### Risk 2: Performance on Large Codebases

Call graph construction can be expensive for large projects.

**Mitigation**: Implement incremental resolution and caching strategies.

### Risk 3: Language-Specific Semantics

Each language has unique call resolution semantics.

**Mitigation**: Modular design allows language-specific implementations.

## Notes

- This task completes the symbol resolution pipeline architecture
- Enables accurate method call resolution across file boundaries
- Foundation for advanced IDE features (find references, call hierarchy)
- Critical for static analysis and refactoring tools

## References

- Symbol resolution pipeline design (task-epic-11.90)
- Call graph requirements analysis
- Module resolution specifications (Node.js, TypeScript, Python)