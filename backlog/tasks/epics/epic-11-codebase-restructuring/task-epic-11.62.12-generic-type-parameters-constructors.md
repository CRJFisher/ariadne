---
id: task-epic-11.62.12
title: Add Generic Type Parameter Support for Constructor Calls
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, type-system, generics, enhancement]
dependencies: [task-epic-11.62.6, task-epic-11.62.7]
parent_task_id: task-epic-11.62
---

## Description

Enhance constructor call detection to capture and track generic type parameters. Currently, we detect `new Array<string>()` but don't capture the `<string>` type parameter, missing crucial type information for generic classes.

## Current Problem

### What We're Missing

```typescript
// Currently detected
const arr = new Array<string>();  // ← We capture "Array" but not "<string>"
const map = new Map<string, number>();  // ← We capture "Map" but not "<string, number>"
const list = new List<User>();  // ← We capture "List" but not "<User>"

// Result: Type tracking thinks these are all just Array/Map/List
// Lost information about element types
```

### TODO Location

In `/packages/core/src/call_graph/constructor_calls/constructor_calls.typescript.ts:45`:
```typescript
// TODO: record the type arguments in ConstructorCallInfo
```

## Acceptance Criteria

### 1. Update ConstructorCallInfo Interface

- [ ] Extend the interface to include type parameters:

```typescript
// In @ariadnejs/types/src/calls.ts
export interface ConstructorCallInfo {
  class_name: string;
  location: Location;
  file_path: string;
  
  // Existing optional fields
  arguments_count?: number;
  assigned_to?: string;
  is_new_expression?: boolean;
  is_factory_method?: boolean;
  
  // NEW: Generic type parameters
  type_parameters?: TypeParameter[];
  type_arguments?: string[];  // Actual types used: ["string", "number"]
  fully_qualified_type?: string;  // Full type: "Map<string, number>"
}

export interface TypeParameter {
  name: string;  // T, K, V, etc.
  constraint?: string;  // extends BaseType
  default?: string;  // = DefaultType
  position: number;  // 0-based index
}
```

### 2. Extract Type Parameters - TypeScript/JavaScript

- [ ] Update TypeScript extractor:

```typescript
// In constructor_calls.typescript.ts
function extract_typescript_constructor_call(
  node: SyntaxNode,
  context: ConstructorCallContext,
  language: Language
): ConstructorCallInfo | null {
  const constructor_name = extract_constructor_name(node, context.source_code, language);
  if (!constructor_name) return null;
  
  // NEW: Extract type arguments
  const type_arguments = extract_type_arguments(node, context.source_code);
  const fully_qualified_type = type_arguments?.length > 0
    ? `${constructor_name}<${type_arguments.join(', ')}>`
    : constructor_name;
  
  const assigned_to = find_assignment_target(node, context.source_code, language);
  
  return {
    class_name: constructor_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    arguments_count: count_constructor_arguments(node, language),
    assigned_to: assigned_to || undefined,
    is_new_expression: true,
    is_factory_method: false,
    type_arguments,  // NEW
    fully_qualified_type,  // NEW
    file_path: context.file_path
  };
}

// NEW: Type argument extraction
function extract_type_arguments(
  node: SyntaxNode,
  source: string
): string[] | undefined {
  // For new_expression nodes
  const constructor = node.childForFieldName('constructor');
  if (!constructor) return undefined;
  
  // Look for type_arguments node
  const type_args = constructor.childForFieldName('type_arguments');
  if (!type_args) return undefined;
  
  const args: string[] = [];
  
  // Iterate through type argument nodes
  for (let i = 0; i < type_args.childCount; i++) {
    const child = type_args.child(i);
    if (child && child.type !== '<' && child.type !== '>' && child.type !== ',') {
      // Extract the type name (handle nested generics recursively)
      const type_text = extract_type_text(child, source);
      if (type_text) {
        args.push(type_text);
      }
    }
  }
  
  return args.length > 0 ? args : undefined;
}

// Handle nested generics: Array<Map<string, number>>
function extract_type_text(node: SyntaxNode, source: string): string {
  if (node.type === 'type_identifier') {
    return source.substring(node.startIndex, node.endIndex);
  }
  
  if (node.type === 'generic_type') {
    const base = node.childForFieldName('name');
    const args = node.childForFieldName('type_arguments');
    
    if (base && args) {
      const base_name = source.substring(base.startIndex, base.endIndex);
      const nested_args: string[] = [];
      
      for (let i = 0; i < args.childCount; i++) {
        const child = args.child(i);
        if (child && child.type !== '<' && child.type !== '>' && child.type !== ',') {
          const nested = extract_type_text(child, source);
          if (nested) nested_args.push(nested);
        }
      }
      
      return `${base_name}<${nested_args.join(', ')}>`;
    }
  }
  
  // Fallback to raw text
  return source.substring(node.startIndex, node.endIndex);
}
```

### 3. Extract Type Parameters - Python

- [ ] Update Python extractor for type hints:

```python
# Python uses [] for generics and type hints
from typing import List, Dict, Optional

# These patterns to detect:
my_list: List[str] = []
my_dict = dict[str, int]()  # Python 3.9+
my_optional: Optional[User] = None
my_generic = MyClass[int, str]()  # Custom generic
```

```typescript
// In constructor_calls.python.ts
function extract_python_type_arguments(
  node: SyntaxNode,
  source: string
): string[] | undefined {
  // Python uses subscript for generics: List[str]
  if (node.type === 'subscript') {
    const value = node.childForFieldName('value');
    const subscript = node.childForFieldName('subscript');
    
    if (subscript) {
      // Handle single type: List[str]
      if (subscript.type === 'identifier' || subscript.type === 'type') {
        return [source.substring(subscript.startIndex, subscript.endIndex)];
      }
      
      // Handle multiple types: Dict[str, int]
      if (subscript.type === 'tuple') {
        const types: string[] = [];
        for (let i = 0; i < subscript.childCount; i++) {
          const child = subscript.child(i);
          if (child && child.type !== ',') {
            types.push(source.substring(child.startIndex, child.endIndex));
          }
        }
        return types;
      }
    }
  }
  
  return undefined;
}
```

### 4. Extract Type Parameters - Rust

- [ ] Update Rust extractor for generics:

```rust
// Rust generic patterns to detect:
let vec: Vec<i32> = Vec::new();
let map = HashMap::<String, i32>::new();
let result: Result<T, E> = Ok(value);
let option = Some::<User>(user);
```

```typescript
// In constructor_calls.rust.ts
function extract_rust_type_arguments(
  node: SyntaxNode,
  source: string
): string[] | undefined {
  // Rust uses ::<T> turbofish or <T> in type position
  
  // Look for type_arguments in call_expression
  if (node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    
    if (func && func.type === 'scoped_identifier') {
      // Check for turbofish ::<T>
      const type_args = func.childForFieldName('type_arguments');
      if (type_args) {
        return extract_rust_generic_args(type_args, source);
      }
    }
  }
  
  // Look for generic_type in let binding
  const parent = node.parent;
  if (parent && parent.type === 'let_declaration') {
    const type_node = parent.childForFieldName('type');
    if (type_node && type_node.type === 'generic_type') {
      const args = type_node.childForFieldName('type_arguments');
      if (args) {
        return extract_rust_generic_args(args, source);
      }
    }
  }
  
  return undefined;
}

function extract_rust_generic_args(
  args_node: SyntaxNode,
  source: string
): string[] {
  const args: string[] = [];
  
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (child && 
        child.type !== '<' && 
        child.type !== '>' && 
        child.type !== ',' &&
        child.type !== '::') {
      args.push(source.substring(child.startIndex, child.endIndex));
    }
  }
  
  return args;
}
```

### 5. Update Type Extraction for Bidirectional Flow

- [ ] Enhance type extraction to include generic parameters:

```typescript
// In constructor_type_extraction.ts
function extract_type_assignment(
  node: SyntaxNode,
  class_name: string,
  source_code: string,
  language: Language
): ConstructorTypeAssignment | null {
  const target = find_assignment_target(node, source_code, language);
  if (!target) {
    // ... existing return value logic ...
  }
  
  // NEW: Extract full generic type
  const type_arguments = extract_type_arguments_for_language(node, source_code, language);
  const full_type = type_arguments?.length > 0
    ? `${class_name}<${type_arguments.join(', ')}>`
    : class_name;
  
  return {
    variable_name: target,
    type_name: full_type,  // Now includes generics
    base_type_name: class_name,  // NEW: Keep base type separate
    type_arguments,  // NEW: Store arguments separately
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    is_property_assignment: is_property
  };
}
```

### 6. Propagate Generic Types Through Analysis

- [ ] Update type tracking to handle generics:

```typescript
// When we know `arr` is `Array<string>`, we can infer:
arr[0]  // type: string
arr.push(x)  // x must be string
arr.map(x => x.length)  // x is string, returns Array<number>
```

```typescript
// In type_tracking enhancement
export interface TypeInfo {
  type_name: string;  // "Array<string>" or "Map<string, number>"
  base_type?: string;  // "Array" or "Map"
  type_arguments?: string[];  // ["string"] or ["string", "number"]
  // ... existing fields ...
}
```

## Testing Requirements

### Unit Tests for Each Language

- [ ] TypeScript/JavaScript generics:

```typescript
describe('Generic type parameter extraction', () => {
  it('should extract single type parameter', () => {
    const source = 'const arr = new Array<string>();';
    const result = extract_constructor_calls_and_types(/* ... */);
    
    expect(result.calls[0].type_arguments).toEqual(['string']);
    expect(result.calls[0].fully_qualified_type).toBe('Array<string>');
  });
  
  it('should extract multiple type parameters', () => {
    const source = 'const map = new Map<string, number>();';
    const result = extract_constructor_calls_and_types(/* ... */);
    
    expect(result.calls[0].type_arguments).toEqual(['string', 'number']);
    expect(result.calls[0].fully_qualified_type).toBe('Map<string, number>');
  });
  
  it('should handle nested generics', () => {
    const source = 'const nested = new Array<Map<string, User>>();';
    const result = extract_constructor_calls_and_types(/* ... */);
    
    expect(result.calls[0].type_arguments).toEqual(['Map<string, User>']);
    expect(result.calls[0].fully_qualified_type).toBe('Array<Map<string, User>>');
  });
  
  it('should handle union types', () => {
    const source = 'const union = new Container<string | number>();';
    const result = extract_constructor_calls_and_types(/* ... */);
    
    expect(result.calls[0].type_arguments).toEqual(['string | number']);
  });
});
```

- [ ] Python type hints:

```typescript
it('should extract Python generic types', () => {
  const source = `
    from typing import List, Dict
    my_list: List[str] = []
    my_dict = Dict[str, int]()
  `;
  
  const result = extract_constructor_calls_and_types(/* ... */);
  
  // Note: Python may not have explicit constructor calls
  // but type annotations should be captured
  const type_info = result.type_assignments.get('my_list');
  expect(type_info[0].type_name).toBe('List[str]');
});
```

- [ ] Rust generics:

```typescript
it('should extract Rust turbofish syntax', () => {
  const source = 'let vec = Vec::<i32>::new();';
  const result = extract_constructor_calls_and_types(/* ... */);
  
  expect(result.calls[0].type_arguments).toEqual(['i32']);
  expect(result.calls[0].fully_qualified_type).toBe('Vec<i32>');
});
```

### Integration Tests

- [ ] Test generic type propagation:

```typescript
it('should propagate generic types through operations', () => {
  const source = `
    const strings = new Array<string>();
    const first = strings[0];  // Should infer: string
    const lengths = strings.map(s => s.length);  // Should infer: Array<number>
  `;
  
  const result = analyze_with_generics(source);
  
  expect(result.type_map.get('first')).toContain({
    type_name: 'string',
    source: 'element_access'
  });
  
  expect(result.type_map.get('lengths')).toContain({
    type_name: 'Array<number>',
    source: 'method_return'
  });
});
```

## Implementation Strategy

### Phase 1: AST Pattern Recognition
1. Identify AST patterns for generics in each language
2. Update tree-sitter queries if needed
3. Document node types for generic expressions

### Phase 2: Extraction Logic
1. Implement extraction functions for each language
2. Handle nested generics recursively
3. Support complex types (unions, intersections, constraints)

### Phase 3: Type Storage
1. Update data structures to store generic info
2. Maintain backward compatibility
3. Add serialization support

### Phase 4: Type Propagation
1. Use generic info in type inference
2. Propagate through method calls
3. Handle variance (covariant/contravariant)

## Edge Cases to Handle

1. **Deeply Nested Generics**:
   ```typescript
   new Map<string, Array<Set<User>>>()
   ```

2. **Conditional Types** (TypeScript):
   ```typescript
   new Container<T extends string ? string[] : number[]>()
   ```

3. **Variance Annotations** (Rust):
   ```rust
   PhantomData<&'a T>
   ```

4. **Type Constraints**:
   ```typescript
   new Container<T extends BaseClass>()
   ```

5. **Default Type Parameters**:
   ```typescript
   new Container<T = string>()  // When T not specified, use string
   ```

6. **Partial Type Application**:
   ```typescript
   type MyMap<K> = Map<K, string>;
   new MyMap<number>();  // Actually Map<number, string>
   ```

## Performance Considerations

1. **Recursive Parsing**: Nested generics need recursive parsing - use memoization
2. **String Building**: Use efficient string builders for complex types
3. **Cache Results**: Cache parsed generic types for repeated patterns
4. **Limit Depth**: Set maximum nesting depth to prevent stack overflow

## Success Metrics

- [ ] Generic type parameters extracted for all supported languages
- [ ] Nested generics handled correctly
- [ ] Type information propagates to type tracking
- [ ] No performance regression (< 5% slower)
- [ ] All existing tests continue passing
- [ ] Generic types appear in enriched type map

## Future Enhancements

After this task:
1. **Type Parameter Constraints**: Extract and validate `extends` clauses
2. **Variance Tracking**: Track co/contravariance for type safety
3. **Generic Method Calls**: Apply same logic to method calls
4. **Type Inference**: Infer generic types from usage
5. **Monomorphization Tracking**: Track concrete instantiations

## Notes

- Generic syntax varies significantly between languages
- Some languages (Python) use runtime generics, others (Rust) use compile-time
- Consider compatibility with existing type systems in each language
- May need language-specific strategies rather than unified approach

## References

- TODO location: `/packages/core/src/call_graph/constructor_calls/constructor_calls.typescript.ts:45`
- Type tracking: `/packages/core/src/type_analysis/type_tracking/`
- Constructor calls: `/packages/core/src/call_graph/constructor_calls/`
- Parent task: task-epic-11.62
- Related: task-epic-11.62.7 (bidirectional type flow)