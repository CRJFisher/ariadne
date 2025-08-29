---
id: task-epic-11.62.4
title: Wire Method Calls to Type Tracking
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, integration, method-resolution]
dependencies: [task-epic-11.62.1, task-epic-11.62.2]
parent_task_id: task-epic-11.62
---

## Description

Wire the method_calls module to consume type information from type_tracking to resolve method receivers. Without knowing the type of the receiver, we cannot determine which class's method is being called.

## Current Problem

The method_calls module works in isolation and cannot:
- Determine the type of method receivers
- Resolve methods to their defining class
- Handle polymorphic method calls
- Track method calls through type aliases

## Acceptance Criteria

### Consume Type Information

- [ ] Update method_calls to accept TypeTracker from context:
```typescript
export function find_method_calls(
  context: ProcessingContext
): MethodCallInfo[] {
  const { ast, source, language } = context.layer0;
  const type_map = context.layer3?.type_map;
  
  // Use type_map to resolve receiver types
}
```

### Resolve Receiver Types

- [ ] Implement receiver type resolution:
```typescript
function resolve_receiver_type(
  receiver: SyntaxNode,
  type_map: TypeMap,
  source: string
): string | undefined {
  const receiver_text = get_node_text(receiver, source);
  
  // Check if receiver is a variable with known type
  const type_info = type_map.get(receiver_text);
  if (type_info) {
    return type_info.type;
  }
  
  // Handle chained calls (foo.bar().baz())
  if (receiver.type === 'member_expression') {
    // Recursively resolve the chain
  }
  
  return undefined;
}
```

### Enhanced Method Call Info

- [ ] Include resolved type in MethodCallInfo:
```typescript
export interface MethodCallInfo {
  // existing fields...
  receiver_type?: string;  // The resolved type of the receiver
  defining_class?: string; // The class that defines this method
}
```

### Language-Specific Patterns

- [ ] **JavaScript/TypeScript**:
  - Handle prototype methods
  - Resolve 'this' context
  - Track method binding
  
- [ ] **Python**:
  - Handle self parameter
  - Resolve class methods (@classmethod)
  - Track static methods (@staticmethod)
  
- [ ] **Rust**:
  - Resolve impl blocks
  - Handle trait methods
  - Track associated functions

## Implementation Example

```typescript
// In method_calls.typescript.ts
export function find_method_calls_typescript(
  context: ProcessingContext
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
        // Resolve the receiver's type
        const receiver_type = resolve_receiver_type(
          receiver,
          type_map,
          source
        );
        
        method_calls.push({
          method_name: get_node_text(method, source),
          receiver: get_node_text(receiver, source),
          receiver_type,  // Now we know the type!
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

- [ ] Test method calls with known receiver types
- [ ] Test chained method calls
- [ ] Test methods on literals (string methods, array methods)
- [ ] Test static method resolution
- [ ] Test methods through type aliases
- [ ] Verify receiver_type field is populated correctly

## Success Metrics

- [ ] Method calls include receiver_type when available
- [ ] Chained method calls resolve correctly
- [ ] Performance impact < 10% on method call detection
- [ ] All existing method call tests still pass
- [ ] Integration test shows improved method resolution

## Notes

- This is a read-only dependency (method_calls reads from type_tracking)
- Type information may be incomplete in first pass
- Consider caching type lookups for performance
- May need multiple passes for complex type chains

## References

- Parent task: task-epic-11.62
- Method calls module: `/packages/core/src/call_graph/method_calls/`
- Type tracking: `/packages/core/src/type_analysis/type_tracking/`
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 4 depends on Layer 3)