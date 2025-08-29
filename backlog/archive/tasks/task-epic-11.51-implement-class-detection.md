# Task: Implement File-Level Class Detection

**Epic**: Epic 11 - Codebase Restructuring  
**Priority**: High  
**Status**: Not Started  
**Dependencies**: 
- Should complete before class_hierarchy can properly assemble

## Problem Statement

The inheritance module currently doesn't have clear separation between file-level class detection (Stage 1) and global class hierarchy building (Stage 2). We need a dedicated class_detection module for Stage 1 processing.

## Success Criteria

- [ ] `detect_classes()` identifies all classes in a file
- [ ] Extracts class metadata (abstract, interface, etc.)
- [ ] Identifies parent classes and implemented interfaces
- [ ] Extracts method signatures with visibility
- [ ] Extracts properties with types
- [ ] Language-specific detection for JS/TS/Python/Rust

## Implementation Plan

1. **JavaScript/TypeScript Classes**
   - ES6 class syntax
   - Constructor functions (legacy)
   - TypeScript interfaces
   - Abstract classes
   - Private fields (#private)

2. **Python Classes**
   - Class definitions
   - Inheritance (single and multiple)
   - Abstract base classes (ABC)
   - Properties and descriptors
   - Class methods vs instance methods

3. **Rust Structures**
   - Struct definitions
   - Impl blocks
   - Trait definitions
   - Trait implementations
   - Associated types and methods

4. **Common Extraction**
   - Method visibility modifiers
   - Static vs instance members
   - Constructor/initializer detection
   - Generic/template parameters

## Technical Considerations

- Keep detection logic simple - just extract, don't resolve
- Use AST node types specific to each language
- Don't resolve inheritance - that's Stage 2's job
- Store parent class names as strings for later resolution

## Testing Requirements

- Unit tests for each language's class syntax
- Edge cases: nested classes, anonymous classes
- Performance tests with files containing many classes

## Location

`/packages/core/src/inheritance/class_detection/`

## Related Files

- `/packages/core/src/inheritance/class_hierarchy/` - Stage 2 assembly
- `/packages/core/src/scope_analysis/scope_tree/` - May identify class scopes
- `/packages/core/src/code_graph.ts` - Integration point