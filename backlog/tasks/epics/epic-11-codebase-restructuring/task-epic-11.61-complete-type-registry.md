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
- [ ] Complete implementation of type registration functions:
  - `register_type()` - Add type to registry with proper namespacing
  - `lookup_type()` - Find type by name with file context
  - `get_file_types()` - Get all types from a file
  - `get_module_exports()` - Get exported types from a module
  - `clear_file_types()` - Support incremental updates
- [ ] Support type namespacing:
  - File-local types
  - Module-exported types
  - Global types (built-ins)
- [ ] Handle type aliases and remapping

### Type Categories
- [ ] Register and track different type kinds:
  - Classes (from class_detection)
  - Interfaces/Traits
  - Enums
  - Type aliases
  - Structs (Rust)
  - Protocols (Python)
  - Union/Intersection types (TypeScript)
- [ ] Track type metadata:
  - Generic parameters with constraints
  - Member signatures
  - Visibility/export status
  - Source location

### Cross-Module Resolution
- [ ] Integrate with module_graph for import resolution
- [ ] Resolve types through re-exports
- [ ] Handle namespace imports (e.g., `import * as foo`)
- [ ] Track type-only imports (TypeScript)

### Language-Specific Support
- [ ] JavaScript: Constructor functions as types
- [ ] TypeScript: Structural types, mapped types, conditional types
- [ ] Python: Type hints, Protocol types, ABCs
- [ ] Rust: Trait objects, associated types

### Integration Points
- [ ] Consume output from:
  - class_detection (ClassDefinition[])
  - export_detection (exported type names)
  - import_resolution (imported types)
- [ ] Provide input to:
  - class_hierarchy (for building inheritance)
  - type_resolution (for resolving references)
  - type_tracking (for variable types)

### Testing
- [ ] Unit tests for all registry operations
- [ ] Integration tests with class_detection output
- [ ] Test incremental updates (file changes)
- [ ] Test circular type dependencies
- [ ] Performance tests with large codebases

## Implementation Notes

### Data Structure
```typescript
interface TypeRegistry {
  // Main storage: qualified_name -> TypeDefinition
  types: Map<string, TypeDefinition>;
  
  // Indexes for fast lookup
  files: Map<string, Set<string>>;          // file -> type names
  exports: Map<string, Map<string, string>>; // module -> export_name -> type_name
  aliases: Map<string, string>;              // alias -> actual_type
  
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