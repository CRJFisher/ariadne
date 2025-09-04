# Task Epic-11.80.5: Integrate type_tracker for Method Call Resolution

## Status
Pending

## Parent Task
Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description
Add type_tracker to FunctionCallContext to improve method call detection by understanding variable types and resolving method calls to their class definitions.

## Implementation Details

### 1. Add Type Tracker to Context
```typescript
interface FunctionCallContext {
  // ... existing fields
  type_tracker?: TypeTracker;
}
```

### 2. Resolve Method Calls Through Types
```typescript
function resolve_method_call(
  node: SyntaxNode,
  type_tracker: TypeTracker,
  source_code: string
): MethodCallInfo | null {
  // Get the object being called on
  const object_node = node.childForFieldName('object');
  const object_name = extract_identifier(object_node, source_code);
  
  // Look up the type of the object
  const object_type = type_tracker.get_type_at_location(
    object_name,
    node_to_location(node)
  );
  
  if (object_type) {
    return {
      object_type: object_type.name,
      is_resolved: true,
      class_name: object_type.class_name,
      // ... other fields
    };
  }
  
  return null;
}
```

### 3. Track Type Flow
- Variable assignments: `const obj = new MyClass()`
- Function returns: `function getObj(): MyClass`
- Property access chains: `obj.prop.method()`

## Benefits
- Accurate method call resolution
- Distinguish between function and method calls
- Better understanding of call targets
- Support for polymorphic call resolution

## Acceptance Criteria
- [ ] Type tracker integrated into context
- [ ] Method calls resolved to their types
- [ ] Variable type flow tracked correctly
- [ ] Tests verify type-based resolution
- [ ] Performance impact measured

## Dependencies
- Task 11.80.4 (complete integration tasks in sequence)

## Estimated Effort
5 hours (most complex integration)
