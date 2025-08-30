---
id: task-epic-11.62.5
title: Wire Method Calls to Class Hierarchy
status: Completed
assignee: []
created_date: "2025-08-29"
completed_date: "2025-08-30"
labels: [epic-11, sub-task, integration, inheritance]
dependencies: [task-epic-11.62.1, task-epic-11.62.2, task-epic-11.61]
parent_task_id: task-epic-11.62
---

## Description

Wire the method_calls module to use class_hierarchy for resolving virtual methods through inheritance chains. This enables proper polymorphic method resolution and tracking of inherited methods.

## Current Problem

Without class hierarchy information, method_calls cannot:
- Resolve methods defined in parent classes
- Track virtual method overrides
- Handle interface/trait method implementations
- Understand method inheritance chains

## Acceptance Criteria

### Create Enrichment Approach

- [x] Created `method_hierarchy_resolver.ts` module for Global Assembly phase enrichment
  - Recognized that method_calls runs in Per-File phase, class_hierarchy in Global Assembly
  - Implemented enrichment pattern instead of direct integration

### Resolve Methods Through Inheritance

- [x] Implemented `resolve_method_in_hierarchy` function:
  - Recursively walks class hierarchy to find method definitions
  - Checks current class, then parent classes, then interfaces
  - Returns defining class and override information

### Track Method Override Information

- [x] Created `MethodCallWithHierarchy` interface extending base with:
  - `defining_class_resolved`: Class that actually defines the method
  - `is_override`: If this overrides a parent method
  - `override_chain`: Classes in override chain
  - `is_interface_method`: If from interface/trait
  - `is_virtual_call`: If this is a virtual method call
  - `possible_targets`: Possible target classes for polymorphic calls

### Virtual Method Analysis

- [x] Implemented `analyze_virtual_call` function:
  - Identifies methods that could dispatch to subclasses
  - Tracks all possible target classes
  - Useful for call graph analysis and optimization

### Helper Functions

- [x] Implemented utility functions:
  - `get_available_methods`: Returns all methods available to a class
  - `is_inherited_method`: Checks if a method is inherited

### Language-Specific Patterns

- [x] **JavaScript/TypeScript**:
  - Tests for ES6 class extends
  - Tests for interface implementations
  - Handles method overrides
  
- [x] **Python**:
  - Tests for multiple inheritance (MRO)
  - Tests for method overrides in inheritance chain
  
- [x] **Rust**:
  - Tests for trait implementations
  - Distinguishes trait methods from inherent methods

## Implementation Example

```typescript
// In method_calls.typescript.ts
export function find_method_calls_typescript(
  context: ProcessingContext,
  class_hierarchy?: ClassHierarchy
): MethodCallInfo[] {
  const { ast, source } = context.layer0;
  const type_map = context.layer3?.type_map || new Map();
  const method_calls: MethodCallInfo[] = [];
  
  ast.descendantsOfType('call_expression').forEach(node => {
    const member = node.childForFieldName('function');
    
    if (member?.type === 'member_expression') {
      const receiver = member.childForFieldName('object');
      const method = member.childForFieldName('property');
      
      if (receiver && method) {
        const receiver_type = resolve_receiver_type(
          receiver,
          type_map,
          source
        );
        
        let defining_class: string | undefined;
        let is_override = false;
        let override_chain: string[] = [];
        
        // If we have hierarchy info, resolve through inheritance
        if (receiver_type && class_hierarchy) {
          const method_def = resolve_method_in_hierarchy(
            receiver_type,
            get_node_text(method, source),
            class_hierarchy
          );
          
          if (method_def) {
            defining_class = method_def.parent_class;
            
            // Check if this is an override
            const parent_classes = class_hierarchy.get_parents(receiver_type);
            for (const parent of parent_classes) {
              if (class_hierarchy.has_method(parent, method_def.name)) {
                is_override = true;
                override_chain = class_hierarchy.get_override_chain(
                  receiver_type,
                  method_def.name
                );
                break;
              }
            }
          }
        }
        
        method_calls.push({
          method_name: get_node_text(method, source),
          receiver: get_node_text(receiver, source),
          receiver_type,
          defining_class,
          is_override,
          override_chain,
          location: node_to_location(node),
          arguments: extract_arguments(node, source),
          language: 'typescript',
          file_path: context.layer0.file_path
        });
      }
    }
  });
  
  return method_calls;
}
```

## Testing Requirements

- [x] Test method resolution through single inheritance
- [x] Test method resolution through multiple inheritance (Python)
- [x] Test interface method implementations
- [x] Test override detection and chains
- [x] Test virtual method analysis
- [x] Verify correct defining_class identification

## Success Metrics

- [x] Methods resolved through inheritance chains
- [x] Override information correctly tracked
- [x] Interface/trait methods properly identified
- [x] All existing method call tests still pass
- [x] Integration tests for all supported languages (JS, TS, Python, Rust)

## Notes

- Depends on class_hierarchy being built (task 11.61)
- This is a read-only dependency during per-file phase
- Class hierarchy is built in global assembly phase
- May need two-pass approach: collect calls first, resolve after hierarchy built

## References

- Parent task: task-epic-11.62
- Method calls module: `/packages/core/src/call_graph/method_calls/`
- Class hierarchy: `/packages/core/src/inheritance/class_hierarchy/`
- Depends on: task-epic-11.61 (class hierarchy must be implemented)
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 4 uses Layer 6 data)

## Implementation Notes

### Key Architectural Decision

**Enrichment Pattern over Direct Integration**: The original task suggested passing class_hierarchy directly to find_method_calls, but this violates the processing phase architecture:

- method_calls runs during Per-File Analysis (parallel phase)
- class_hierarchy is built during Global Assembly (sequential phase)
- Per-File modules cannot use Global Assembly data

**Solution**: Created an enrichment pattern where:

1. Method calls are collected during Per-File phase with local type info only
2. After class hierarchy is built in Global Assembly, an enrichment function enhances method calls
3. This maintains phase separation while achieving the desired functionality

### Files Created

- **method_hierarchy_resolver.ts**: Core enrichment module with:
  - `enrich_method_calls_with_hierarchy`: Main enrichment function
  - `resolve_method_in_hierarchy`: Recursive method resolution
  - `analyze_virtual_call`: Polymorphic call analysis
  - Helper functions for inheritance queries

- **method_hierarchy_resolver.test.ts**: Unit tests for resolver logic

- **method_hierarchy_language_integration.test.ts**: Language-specific integration tests covering:
  - JavaScript ES6 class inheritance
  - TypeScript interface implementations  
  - Python multiple inheritance with MRO
  - Rust trait implementations

### Integration Point

Added TODO comment in `code_graph.ts` (lines 169-177) for where the enrichment should be called once the Global Assembly infrastructure is complete.

### Design Benefits

1. **Phase Separation**: Maintains clean separation between processing phases
2. **Incremental Enhancement**: Method calls work without hierarchy, get enriched when available
3. **Virtual Call Analysis**: Provides foundation for polymorphic call graph analysis
4. **Language Agnostic**: Core logic works for all languages with language-specific tests

### Future Work

- Wire up enrichment when Global Assembly phase is fully implemented
- Add support for abstract methods and pure virtual functions
- Enhance virtual call analysis with type flow information
- Consider caching for performance in large codebases
