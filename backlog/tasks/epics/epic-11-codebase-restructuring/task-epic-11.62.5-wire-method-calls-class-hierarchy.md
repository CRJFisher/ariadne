---
id: task-epic-11.62.5
title: Wire Method Calls to Class Hierarchy
status: To Do
assignee: []
created_date: "2025-08-29"
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

### Consume Class Hierarchy

- [ ] Update method_calls to accept ClassHierarchy from context:
```typescript
export function find_method_calls(
  context: ProcessingContext,
  class_hierarchy?: ClassHierarchy  // From global assembly
): MethodCallInfo[] {
  // Use hierarchy to resolve inherited methods
}
```

### Resolve Methods Through Inheritance

- [ ] Implement method resolution through class hierarchy:
```typescript
function resolve_method_in_hierarchy(
  class_name: string,
  method_name: string,
  class_hierarchy: ClassHierarchy
): MethodDefinition | undefined {
  // Check if method exists in this class
  const class_def = class_hierarchy.get_class(class_name);
  const method = class_def?.methods.find(m => m.name === method_name);
  
  if (method) {
    return method;
  }
  
  // Check parent classes
  const parent_classes = class_hierarchy.get_parents(class_name);
  for (const parent of parent_classes) {
    const inherited = resolve_method_in_hierarchy(
      parent,
      method_name,
      class_hierarchy
    );
    if (inherited) {
      return inherited;
    }
  }
  
  return undefined;
}
```

### Track Method Override Information

- [ ] Enhance MethodCallInfo with inheritance data:
```typescript
export interface MethodCallInfo {
  // existing fields...
  defining_class?: string;      // Class that defines the method
  is_override?: boolean;        // If this overrides a parent method
  override_chain?: string[];    // Classes in override chain
  is_interface_method?: boolean; // If from interface/trait
}
```

### Language-Specific Inheritance Patterns

- [ ] **JavaScript/TypeScript**:
  - Handle ES6 class extends
  - Resolve super.method() calls
  - Track prototype chain methods
  
- [ ] **Python**:
  - Handle multiple inheritance (MRO)
  - Resolve super() calls
  - Track abstract methods (@abstractmethod)
  
- [ ] **Rust**:
  - Resolve trait implementations
  - Handle default trait methods
  - Track associated functions

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

- [ ] Test method resolution through single inheritance
- [ ] Test method resolution through multiple inheritance (Python)
- [ ] Test interface method implementations
- [ ] Test override detection and chains
- [ ] Test super/parent method calls
- [ ] Verify correct defining_class identification

## Success Metrics

- [ ] Methods resolved through inheritance chains
- [ ] Override information correctly tracked
- [ ] Interface/trait methods properly identified
- [ ] All existing method call tests still pass
- [ ] Integration test shows polymorphic resolution working

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