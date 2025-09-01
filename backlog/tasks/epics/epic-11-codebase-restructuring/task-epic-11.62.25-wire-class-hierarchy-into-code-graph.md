# Task 11.62.25: Wire class_hierarchy into code_graph.ts

**Status:** Not Started  
**Assignee:** Unassigned  
**Priority:** Critical  
**Estimated Effort:** 3 hours  
**Dependencies:** Tasks 11.62.22-24 (Type system updates)  
**Created:** 2025-09-01  

## Summary

Properly integrate the class hierarchy builder into the code_graph.ts processing pipeline, replacing the stub implementation (lines 965-1001) with actual functionality that builds a complete class hierarchy during the Global Assembly phase.

## Problem Statement

The current `code_graph.ts` has a stub implementation for class hierarchy building:

1. **Lines 965-1001:** Placeholder function that returns empty hierarchy
2. **Line 191:** Call to build_class_hierarchy_from_analyses but implementation is incomplete
3. **Line 299:** Uses the stub hierarchy instead of real one
4. **Missing:** Proper integration with the class_hierarchy module
5. **Missing:** Type conversion from ClassInfo to ClassDefinition

## Research & Analysis

### Current Stub Implementation

```typescript
// Lines 965-1001: Current placeholder
async function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[]
): Promise<ClassHierarchy> {
  // Collect all class definitions with their file context
  const all_classes: any[] = [];
  // ... collecting classes but not building hierarchy ...
  
  // Returns empty stub!
  const hierarchy: ClassHierarchy = {
    classes: new Map(),
    inheritance_edges: [],
    root_classes: new Set(),
  };
  
  return hierarchy;  // Empty!
}
```

### Where It's Used

```typescript
// Line 191: Built during Global Assembly
const class_hierarchy = await build_class_hierarchy_from_analyses(analyses);

// Line 228-230: Used for method enrichment
const enriched_method_calls = enrich_method_calls_with_hierarchy(
  analysis.method_calls,
  class_hierarchy  // Currently empty!
);

// Line 299: Assigned to code graph
const classes = class_hierarchy;  // Empty hierarchy!
```

### Processing Pipeline Position

According to PROCESSING_PIPELINE.md, class hierarchy should be built in:
- **Layer 6:** Type Registry & Class Hierarchy (Global Assembly Phase)
- **After:** Module Graph Construction (Layer 5)
- **Before:** Cross-File Type Resolution (Layer 7)

## Solution Design

### 1. Import Proper Class Hierarchy Builder

```typescript
import { 
  build_class_hierarchy,
  ClassHierarchyContext 
} from './inheritance/class_hierarchy/class_hierarchy';
```

### 2. Convert ClassInfo to ClassDefinition

```typescript
function convert_class_info_to_definition(
  classInfo: ClassInfo,
  file_path: string,
  language: Language
): ClassDefinition {
  return {
    name: classInfo.name,
    location: classInfo.location,
    file_path,
    language,
    extends: classInfo.base_classes,
    implements: classInfo.interfaces,
    is_abstract: classInfo.is_abstract,
    is_final: false,  // TODO: Extract from decorators/keywords
    methods: classInfo.methods.map(m => convert_method_info_to_definition(m)),
    properties: classInfo.properties.map(p => convert_property_info_to_definition(p)),
    decorators: classInfo.decorators,
    generics: [],  // TODO: Extract generic parameters
  };
}
```

### 3. Implement Proper Class Hierarchy Building

```typescript
async function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[]
): Promise<ClassHierarchy> {
  // Step 1: Convert all ClassInfo to ClassDefinition
  const all_class_definitions: ClassDefinition[] = [];
  const contexts = new Map<string, ClassHierarchyContext>();
  
  for (const analysis of analyses) {
    // Convert each class to ClassDefinition
    for (const classInfo of analysis.classes) {
      const classDef = convert_class_info_to_definition(
        classInfo,
        analysis.file_path,
        analysis.language
      );
      all_class_definitions.push(classDef);
    }
    
    // Create context for this file (needed for AST access)
    contexts.set(analysis.file_path, {
      tree: null,  // TODO: Need to preserve AST from parsing
      source_code: '',  // TODO: Need source code
      file_path: analysis.file_path,
      language: analysis.language,
      all_definitions: all_class_definitions
    });
  }
  
  // Step 2: Build the actual hierarchy using the class_hierarchy module
  const hierarchy = build_class_hierarchy(
    all_class_definitions,
    contexts
  );
  
  // Step 3: Extract inheritance relationships
  for (const classDef of all_class_definitions) {
    // Process extends relationships
    if (classDef.extends) {
      for (const parentName of classDef.extends) {
        const parentDef = all_class_definitions.find(
          c => c.name === parentName
        );
        if (parentDef) {
          // Add inheritance edge
          // (This will be handled by build_class_hierarchy)
        }
      }
    }
    
    // Process implements relationships
    if (classDef.implements) {
      for (const interfaceName of classDef.implements) {
        // Find interface definition and add edge
        // (This will be handled by build_class_hierarchy)
      }
    }
  }
  
  return hierarchy;
}
```

### 4. Add AST Preservation

Currently, the AST is discarded after per-file analysis. We need to preserve it for class hierarchy building:

```typescript
// In analyze_file function, preserve the tree
const file_analysis: FileAnalysis & { 
  ast?: Tree;  // Add AST to extended type
  source?: string;  // Add source code
} = {
  // ... existing fields ...
  ast: tree,  // Preserve the parsed tree
  source: source_code,  // Preserve source
};
```

### 5. Update ClassHierarchy Type Usage

Ensure the returned ClassHierarchy matches the expected type in code_graph.ts:

```typescript
// The ClassHierarchy from class_hierarchy.ts needs to match
// the ClassHierarchy type from @ariadnejs/types
import { ClassHierarchy as TypesClassHierarchy } from '@ariadnejs/types';

// May need a converter if types don't match exactly
function convert_to_types_hierarchy(
  hierarchy: LocalClassHierarchy
): TypesClassHierarchy {
  // Convert if needed
}
```

## Implementation Steps

1. **Import class_hierarchy module** functions
2. **Create type converters** (ClassInfo → ClassDefinition)
3. **Preserve AST and source** in FileAnalysis
4. **Implement proper hierarchy building** function
5. **Handle language-specific inheritance** patterns
6. **Test with real class data**
7. **Verify enrichment functions** work with real hierarchy

## Acceptance Criteria

- [ ] Class hierarchy properly built from all files
- [ ] Inheritance relationships correctly identified
- [ ] Interface implementations tracked
- [ ] Method enrichment works with real hierarchy
- [ ] No empty hierarchy returned
- [ ] All tests pass

## Benefits

1. **Complete Analysis:** Full class hierarchy available
2. **Method Resolution:** Can resolve methods through inheritance
3. **Virtual Calls:** Can track polymorphic dispatch
4. **Type Safety:** Proper typing throughout
5. **Cross-File Analysis:** Complete project understanding

## Testing Plan

1. Test with simple single-inheritance classes
2. Test with interface implementations
3. Test with multiple inheritance (Python)
4. Test with traits (Rust)
5. Test cross-file inheritance
6. Verify method resolution works

## Implementation Notes

_To be filled during implementation_

## Completion Checklist

- [ ] Class hierarchy builder properly imported
- [ ] Type converters implemented
- [ ] AST/source preservation added
- [ ] Real hierarchy built (not stub)
- [ ] Integration with enrichment verified
- [ ] Tests updated and passing