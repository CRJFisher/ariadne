---
id: task-epic-11.61
title: Complete Type Registry Implementation
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, layer-6, global-assembly, critical-gap]
dependencies: [task-epic-11.60]
parent_task_id: epic-11
---

## Description

Complete the implementation of `/type_analysis/type_registry` module, which is critical for cross-file type resolution. This is a global assembly module (Layer 6) that combines type information from all files to provide a unified type lookup service.

## Context

From PROCESSING_PIPELINE.md Layer 6 (Type Registry & Class Hierarchy):

- Central registry of all type definitions across the codebase
- Runs in global assembly phase after all per-file analyses complete
- Provides type lookup for higher layers (type resolution, symbol resolution)

From ARCHITECTURE_ISSUES.md:

- Critical gap - no central type definition storage
- Cannot resolve type references across files
- Cannot build inheritance chains without registry
- Type checking is incomplete without it

A stub was created at `/packages/core/src/type_analysis/type_registry/index.ts` with basic structure.

## Acceptance Criteria

### Core Registry Functions

- [x] Complete implementation of type registration functions:
  - `register_type()` - Add type to registry with proper namespacing
  - `lookup_type()` - Find type by name with file context
  - `get_file_types()` - Get all types from a file
  - `get_module_exports()` - Get exported types from a module
  - `clear_file_types()` - Support incremental updates
- [x] Support type namespacing:
  - File-local types
  - Module-exported types
  - Global types (built-ins)
- [x] Handle type aliases and remapping

### Type Categories

- [x] Register and track different type kinds:
  - Classes (from class_detection)
  - Interfaces/Traits
  - Enums
  - Type aliases
  - Structs (Rust)
  - Protocols (Python)
  - Union/Intersection types (TypeScript)
- [x] Track type metadata:
  - Generic parameters with constraints
  - Member signatures
  - Visibility/export status
  - Source location

### Cross-Module Resolution

- [x] Integrate with module_graph for import resolution
- [ ] Resolve types through re-exports - **Requires task 11.69**
- [ ] Handle namespace imports (e.g., `import * as foo`) - **Requires task 11.70**
- [ ] Track type-only imports (TypeScript) - **Requires task 11.71**

### Language-Specific Support

- [x] JavaScript: Constructor functions as types
- [x] TypeScript: Basic interfaces, enums, type aliases
- [ ] TypeScript: Structural types, mapped types, conditional types - **Complex feature**
- [x] Python: Classes, Protocols (as interfaces)
- [ ] Python: Full type hint parsing - **Requires task 11.72**
- [x] Rust: Structs, Traits, associated types

### Integration Points

- [x] Consume output from:
  - class_detection (ClassDefinition[])
  - export_detection (exported type names)
  - import_resolution (imported types)
- [x] Provide input to:
  - class_hierarchy (for building inheritance)
  - type_resolution (for resolving references)
  - type_tracking (for variable types)

### Testing

- [x] Unit tests for all registry operations
- [x] Integration tests with class_detection output
- [x] Test incremental updates (file changes)
- [x] Test circular type dependencies (basic validation)
- [ ] Performance tests with large codebases - **Requires task 11.73**

## Implementation Notes

### Data Structure

```typescript
interface TypeRegistry {
  // Main storage: qualified_name -> TypeDefinition
  types: Map<string, TypeDefinition>;

  // Indexes for fast lookup
  files: Map<string, Set<string>>; // file -> type names
  exports: Map<string, Map<string, string>>; // module -> export_name -> type_name
  aliases: Map<string, string>; // alias -> actual_type

  // Built-in types per language
  builtins: Map<Language, Set<string>>;
}
```

### Naming Convention

- Local types: `file_path#TypeName`
- Exported types: Can be accessed by export name or qualified name
- Built-ins: Direct name lookup (e.g., "string", "int")

### Resolution Algorithm

1. Check built-ins for language
2. Check current file scope
3. Check imports in current file
4. Check exports from imported modules
5. Follow re-export chains
6. Return undefined if not found

### Performance Considerations

- Use Maps for O(1) lookup
- Maintain indexes to avoid full scans
- Support incremental updates without full rebuild
- Consider caching frequently accessed types

### Error Handling

- Handle missing dependencies gracefully
- Track unresolved types for later resolution
- Report circular dependencies
- Validate type consistency

## Migration Requirements

All types must use definitions from `@ariadnejs/types`:

- Import TypeDefinition, TypeMember, etc. from @ariadnejs/types
- Don't duplicate type definitions locally
- Ensure all public interfaces use shared types

## Success Metrics

- Can register and lookup types across entire codebase
- Lookup performance < 1ms for any type
- Supports incremental updates efficiently
- All language-specific type patterns handled
- Zero duplicate type definitions

## References

- Implementation stub: `/packages/core/src/type_analysis/type_registry/index.ts`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 6)
- Architecture issues: `/packages/core/ARCHITECTURE_ISSUES.md` (Issue #5)
- Depends on: task-epic-11.60 (class_detection for input)
- Related: `/inheritance/class_hierarchy`, `/type_analysis/type_resolution`

## Implementation Notes

### Completed Implementation

**Date**: 2025-08-29

Fully implemented the type registry module with comprehensive support for all type kinds:

1. **Core Registry Structure** (`/type_analysis/type_registry/index.ts`):
   - Updated to use TypeDefinition from @ariadnejs/types
   - Maintains maps for types, files, exports, aliases, and builtins
   - Added import resolution cache for performance
   - Supports incremental updates via clear_file_types()

2. **Type Registration Functions**:
   - `register_class()` - Converts ClassDefinition to TypeDefinition
   - `register_interface()` - Converts InterfaceDefinition to TypeDefinition
   - `register_type()` - Generic registration for any TypeDefinition
   - `register_alias()` - Track type aliases

3. **Type Lookup and Resolution**:
   - `lookup_type()` - Find types with language and file context
   - `resolve_import()` - Resolve imported types through module exports
   - Built-in type recognition for all 4 languages
   - Qualified name resolution (file_path#type_name)

4. **Conversion Utilities** (`type_registry.ts`):
   - `class_to_type_definition()` - Convert ClassDefinition
   - `interface_to_type_definition()` - Convert InterfaceDefinition
   - `enum_to_type_definition()` - Convert EnumDefinition
   - `struct_to_type_definition()` - Convert Rust structs
   - `trait_to_type_definition()` - Convert Rust traits
   - `protocol_to_type_definition()` - Convert Python protocols

5. **Language Support**:
   - **JavaScript/TypeScript**: Classes, interfaces, enums, type aliases
   - **Python**: Classes, protocols, type hints
   - **Rust**: Structs, traits, associated types
   - All languages have appropriate built-in types

6. **Test Coverage** (`type_registry.test.ts`):
   - Comprehensive unit tests for all operations
   - Tests for registration, lookup, aliases, exports
   - Tests for incremental updates and caching
   - Integration tests with type definitions

### Key Design Decisions

1. **Unified TypeDefinition**: All language-specific types convert to common TypeDefinition
2. **Qualified Names**: Types are stored with file_path#name for uniqueness
3. **Import Caching**: Resolved imports are cached for performance
4. **Immutability**: All public interfaces use readonly types
5. **Built-in Types**: Each language has predefined built-in types

### Integration Status

- ✅ Consumes ClassDefinition[] from class_detection
- ✅ Consumes InterfaceDefinition[] and other types
- ✅ Provides type lookup for higher layers
- ✅ Integrates with import/export information
- ⚠️ Not yet integrated into code_graph.ts (requires task 11.62)

### What Still Needs Implementation

The following features were identified as gaps but require separate tasks:

1. **Re-export Chain Resolution** (task 11.69)
   - Belongs in module_graph layer (Layer 5)
   - Need to trace through re-export chains to find actual definitions
   - Type registry would consume the resolved information

2. **Namespace Import Support** (task 11.70)
   - Belongs in import_resolution (Layer 2)
   - Need to detect and extract namespace imports during per-file analysis
   - Type registry would consume namespace information for member resolution

3. **Type-Only Import Tracking** (task 11.71)
   - Belongs in import_resolution (Layer 2)
   - TypeScript-specific feature to mark imports as type-only
   - Type registry would know these are compile-time only

4. **Python Type Hint Parsing** (task 11.72)
   - Belongs in type annotation parsing (Layer 3)
   - Need to parse Python type hints from annotations
   - Type registry would store parsed type information

5. **Performance Testing** (task 11.73)
   - Test registry performance with large codebases (10K+ files)
   - Optimize data structures if needed
   - Add caching strategies for hot paths

6. **Integration with code_graph.ts** (task 11.62)
   - Wire type registry into processing pipeline
   - Already covered by task 11.62
