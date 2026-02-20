# Task: Implement Global Type Resolution

**Epic**: Epic 11 - Codebase Restructuring  
**Priority**: High  
**Status**: Not Started  
**Dependencies**: 
- task-epic-11.32 (graph_builder implementation)
- Requires type_tracking (Stage 1) to be working

## Problem Statement

Type analysis currently only tracks types within individual files (Stage 1). We need Stage 2 processing to resolve type references across file boundaries, handle imports, and understand inheritance relationships.

## Success Criteria

- [ ] `build_type_index()` creates a global type index from file-level type info
- [ ] `resolve_type_reference()` can resolve types across files via imports
- [ ] Type resolution understands class inheritance hierarchies
- [ ] Generic types are properly tracked and resolved
- [ ] Type aliases are followed to their definitions
- [ ] Built-in language types are recognized

## Implementation Plan

1. **Collect Type Definitions**
   - Gather all type definitions from FileAnalysis results
   - Create qualified names (file#type format)
   - Handle type parameters/generics

2. **Import Resolution**
   - Use ModuleGraph to resolve imported types
   - Track type import chains
   - Handle namespace imports (e.g., `import * as ns`)

3. **Inheritance Integration**
   - Use ClassHierarchy for method/property type resolution
   - Build type compatibility relationships
   - Handle interface implementations

4. **Type Alias Resolution**
   - Follow type aliases to base types
   - Handle circular type references
   - Resolve union/intersection types

5. **Language-Specific Handling**
   - JavaScript: Handle JSDoc type annotations
   - TypeScript: Full type system support
   - Python: Type hints and docstring types
   - Rust: Trait bounds and lifetimes

## Technical Considerations

- Memory efficiency: Don't duplicate type information
- Use string IDs for cross-references
- Cache resolution results for performance
- Handle missing/unresolved types gracefully

## Testing Requirements

- Unit tests for each resolution scenario
- Integration tests with real codebases
- Cross-file type resolution test cases
- Performance tests with large type hierarchies

## Location

`/packages/core/src/type_analysis/type_resolution/`

## Related Files

- `/packages/core/src/type_analysis/type_tracking/` - Stage 1 type extraction
- `/packages/core/src/import_export/module_graph/` - For import resolution
- `/packages/core/src/inheritance/class_hierarchy/` - For inheritance info
- `/packages/core/src/code_graph.ts` - Integration point