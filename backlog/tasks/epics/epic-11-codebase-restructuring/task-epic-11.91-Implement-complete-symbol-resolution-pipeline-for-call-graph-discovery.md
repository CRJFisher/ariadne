# Task: Implement Complete Symbol Resolution Pipeline for Call Graph Discovery

**Task ID**: task-epic-11.91
**Parent**: epic-11-codebase-restructuring
**Status**: Completed
**Priority**: Critical
**Created**: 2025-01-20
**Estimated Effort**: 7-9 days

## Sub-Tasks

1. **task-epic-11.91.1**: Implement import/export resolution infrastructure (2.5-3 days) ✅ **Completed**
   - 11.91.1.1: Core import resolution infrastructure (1-1.5 days) ✅ **Completed**
   - 11.91.1.2: Language-specific import handlers (1-1.5 days) ✅ **Completed**

2. **task-epic-11.91.2**: Implement function call resolution (2-3 days) ✅ **Completed**
   - 11.91.2.1: Lexical scope resolution infrastructure (1-1.5 days) ✅ **Completed**
   - 11.91.2.2: Function call resolution with import integration (1-1.5 days) ✅ **Completed**

3. **task-epic-11.91.3**: Enhance method and constructor resolution (2-3 days) ✅ **Completed**
   - 11.91.3.1: Basic method resolution and type lookup (1-1.5 days) ✅ **Completed**
   - 11.91.3.2: Inheritance chain resolution and constructor enhancement (1-1.5 days) ✅ **Completed**

4. **task-epic-11.91.4**: Integration testing and performance optimization (2-3 days) ✅ **Completed**

## Problem Statement

Following the successful completion of task-epic-11.90 (type processing separation), the symbol resolution pipeline now has Phase 3 (Type Resolution) fully implemented. However, Phases 1 and 2 remain unimplemented, preventing complete symbol resolution and future call graph construction.

### Current State Analysis

**Implemented Components**:
- ✅ **Phase 3: Type Resolution** - Complete with type_resolution modules
- ✅ **Phase 4: Method/Constructor Resolution** - Basic implementation depends on Phases 1-2
- ✅ **Call Data Extraction** - semantic_index extracts CallReference, MemberAccessReference
- ✅ **Type Members Resolution** - Cross-file inheritance and member resolution

**Missing Components**:
- ✅ **Phase 1: Import/Export Resolution** - Completed with full language support
- ✅ **Phase 2: Function Call Resolution** - Completed with lexical scope resolution
- ✅ **Enhanced Phase 4: Method/Constructor Resolution** - Completed with inheritance support
- ✅ **Integration Testing and Data Export** - Completed with comprehensive test suite

### Complete Symbol Resolution Requirements

To enable comprehensive symbol resolution for future call graph construction, we need:

1. **Import Resolution**: Map imported symbols to their source definitions
2. **Function Call Resolution**: Resolve function calls via lexical scoping and imports
3. **Method Call Resolution**: Resolve method calls using type information and inheritance
4. **Constructor Call Resolution**: Resolve constructor invocations with proper type context
5. **Data Export**: Provide clean interfaces for resolved symbol data
6. **Integration Testing**: Comprehensive validation across real-world codebases

## Solution Overview

Implement the remaining phases of the symbol resolution pipeline with comprehensive testing and data export capabilities to provide a complete foundation for future call graph construction.

**Note**: This task was restructured to focus on symbol resolution only, with call graph construction separated into future work. The 4 main tasks are further subdivided into 8 focused sub-tasks for better incremental progress.

### Architecture Overview

```
semantic_index/               # Single-file extraction (✅ Complete)
├── call_references/          # Extract call information
├── member_access_references/ # Extract method access patterns
└── type_flow_references/     # Extract constructor calls

symbol_resolution/            # Cross-file resolution
├── import_resolution/        # ❌ Import/export mapping (11.91.1)
├── function_resolution/      # ❌ Function call resolution (11.91.2)
├── type_resolution/          # ✅ Type tracking & resolution (11.90)
├── method_resolution/        # ❌ Enhanced method/constructor resolution (11.91.3)
├── integration_tests/        # ❌ End-to-end testing (11.91.4)
└── data_export/             # ❌ Clean data export interfaces (11.91.4)
```

### Key Technical Challenges

1. **Import Path Resolution**: Handle relative/absolute imports, node_modules, package.json across languages
2. **Lexical Scope Resolution**: Walk scope chains for function call resolution with language-specific rules
3. **Hoisting Semantics**: Handle JavaScript/TypeScript var/function hoisting vs Python/Rust scoping
4. **Inheritance Resolution**: Method resolution through complex inheritance hierarchies and interfaces
5. **Performance at Scale**: Efficient resolution algorithms for large codebases (10,000+ files)
6. **Data Export Design**: Clean, extensible interfaces for future call graph construction

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

Symbol resolution can be expensive for large projects with complex dependencies.

**Mitigation**: Implement incremental resolution, caching strategies, and parallel processing.

### Risk 3: Language-Specific Semantics

Each language has unique call resolution semantics.

**Mitigation**: Modular design allows language-specific implementations.

## Notes

- This task completes the symbol resolution pipeline architecture
- Provides comprehensive symbol mappings for all call types (functions, methods, constructors)
- Enables accurate cross-file symbol resolution across multiple languages
- Foundation for future call graph construction and advanced IDE features
- Critical for static analysis, refactoring tools, and dependency analysis

## References

- Symbol resolution pipeline design (task-epic-11.90)
- Call graph requirements analysis
- Module resolution specifications (Node.js, TypeScript, Python)