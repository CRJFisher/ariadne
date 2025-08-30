---
id: task-epic-11.62.13
title: Implement Return Type Inference from Constructor Calls
status: To Do
assignee: []
created_date: "2025-08-30"
labels: [epic-11, sub-task, type-inference, function-signatures, enhancement]
dependencies: [task-epic-11.62.7, task-epic-11.62.12]
parent_task_id: task-epic-11.62
---

## Description

Implement return type inference for functions that return constructor calls. When a function returns `new Foo()`, we should automatically infer that the function's return type is `Foo`. This creates a powerful connection between constructor detection and function signature enrichment.

## Current Problem

### What We're Missing

```typescript
// Current state: Return types not inferred
function createUser() {
  return new User();  // We detect the constructor but don't update function signature
}

function factory(type) {
  if (type === 'admin') {
    return new Admin();  // Multiple return paths with different types
  }
  return new User();
}

const buildThing = () => new Thing();  // Arrow functions also need inference
```

### TODO Locations

Multiple files have this TODO:
- `/packages/core/src/type_analysis/type_tracking/type_tracking.typescript.ts:12`
- `/packages/core/src/type_analysis/type_tracking/type_tracking.python.ts:11`
- `/packages/core/src/type_analysis/type_tracking/type_tracking.javascript.ts:11`
- `/packages/core/src/type_analysis/type_tracking/type_tracking.rust.ts:12`

All state: `// TODO: Return Type Inference - Update type map with inferred types`

## Acceptance Criteria

### 1. Detect Return Statements with Constructors

- [ ] Update constructor extraction to track return context:

```typescript
// In constructor_type_extraction.ts
export interface ConstructorTypeAssignment {
  variable_name: string;
  type_name: string;
  location: Location;
  is_property_assignment?: boolean;
  is_return_value?: boolean;
  
  // NEW: Track which function this is returned from
  containing_function?: string;
  function_location?: Location;
  is_async?: boolean;  // async functions return Promise<T>
}

// Enhanced extraction
function extract_type_assignment(
  node: SyntaxNode,
  class_name: string,
  source_code: string,
  language: Language
): ConstructorTypeAssignment | null {
  const target = find_assignment_target(node, source_code, language);
  
  if (!target) {
    // Check if it's a return value
    const return_context = get_return_context(node, source_code, language);
    if (return_context) {
      return {
        variable_name: '<return>',
        type_name: return_context.is_async 
          ? `Promise<${class_name}>`  // async function
          : class_name,
        location: {
          line: node.startPosition.row,
          column: node.startPosition.column
        },
        is_return_value: true,
        containing_function: return_context.function_name,
        function_location: return_context.function_location,
        is_async: return_context.is_async
      };
    }
    return null;
  }
  
  // ... existing assignment logic ...
}
```

### 2. Extract Function Context

- [ ] Implement function context detection:

```typescript
interface ReturnContext {
  function_name: string;
  function_location: Location;
  is_async: boolean;
  is_generator: boolean;
  is_arrow_function: boolean;
  scope_path: string[];
}

function get_return_context(
  node: SyntaxNode,
  source: string,
  language: Language
): ReturnContext | null {
  let current = node.parent;
  
  while (current) {
    // Check if we're inside a return statement
    if (current.type === 'return_statement') {
      // Now find the containing function
      const func_node = find_containing_function(current);
      if (func_node) {
        return extract_function_context(func_node, source, language);
      }
    }
    
    // Stop at statement boundaries
    if (is_statement_boundary(current)) {
      break;
    }
    
    current = current.parent;
  }
  
  return null;
}

function find_containing_function(node: SyntaxNode): SyntaxNode | null {
  let current = node.parent;
  
  while (current) {
    const function_types = [
      'function_declaration',
      'function_expression',
      'arrow_function',
      'method_definition',
      'function_definition',  // Python
      'function_item',  // Rust
    ];
    
    if (function_types.includes(current.type)) {
      return current;
    }
    
    current = current.parent;
  }
  
  return null;
}

function extract_function_context(
  func_node: SyntaxNode,
  source: string,
  language: Language
): ReturnContext {
  const name = extract_function_name(func_node, source, language);
  const is_async = check_if_async(func_node, language);
  const is_generator = check_if_generator(func_node, language);
  const is_arrow = func_node.type === 'arrow_function';
  const scope_path = build_scope_path(func_node, source);
  
  return {
    function_name: name || '<anonymous>',
    function_location: {
      line: func_node.startPosition.row,
      column: func_node.startPosition.column
    },
    is_async,
    is_generator,
    is_arrow_function: is_arrow,
    scope_path
  };
}
```

### 3. Build Function Return Type Map

- [ ] Create a map of functions to their inferred return types:

```typescript
// New data structure for function return types
export interface FunctionReturnTypes {
  // Key: "file_path:function_name:line:column"
  // Value: Array of possible return types
  return_types: Map<string, InferredReturnType[]>;
}

export interface InferredReturnType {
  type_name: string;
  confidence: number;
  source: 'constructor' | 'literal' | 'variable' | 'method_call';
  location: Location;  // Where the return statement is
  conditions?: string[];  // If inside conditional: ["type === 'admin'"]
}

// Build return type map from constructor calls
export function build_return_type_map(
  constructor_result: ConstructorCallResult
): FunctionReturnTypes {
  const return_types = new Map<string, InferredReturnType[]>();
  
  for (const [var_name, types] of constructor_result.type_assignments) {
    // Filter for return values
    const return_assignments = types.filter(t => 
      var_name === '<return>' && t.containing_function
    );
    
    for (const assignment of return_assignments) {
      const func_key = build_function_key(
        assignment.containing_function!,
        assignment.function_location!,
        assignment.file_path
      );
      
      const existing = return_types.get(func_key) || [];
      existing.push({
        type_name: assignment.type_name,
        confidence: 1.0,  // Constructor calls are high confidence
        source: 'constructor',
        location: assignment.location,
        conditions: extract_conditions(assignment.ast_node)
      });
      
      return_types.set(func_key, existing);
    }
  }
  
  return { return_types };
}
```

### 4. Handle Multiple Return Paths

- [ ] Support functions with multiple return statements:

```typescript
function analyze_return_types(func_node: SyntaxNode, source: string): InferredReturnType[] {
  const returns: InferredReturnType[] = [];
  
  // Find all return statements in function
  const return_statements = find_all_returns(func_node);
  
  for (const ret of return_statements) {
    const value = ret.childForFieldName('value');
    if (!value) {
      // Void return
      returns.push({
        type_name: 'void',
        confidence: 1.0,
        source: 'literal',
        location: node_to_location(ret)
      });
      continue;
    }
    
    // Check if returning a constructor
    if (is_constructor_call_node(value, language)) {
      const class_name = extract_constructor_name(value, source, language);
      if (class_name) {
        returns.push({
          type_name: class_name,
          confidence: 1.0,
          source: 'constructor',
          location: node_to_location(ret),
          conditions: extract_branch_conditions(ret)
        });
      }
    }
    
    // Check if returning a literal
    const literal_type = infer_literal_type(value, source);
    if (literal_type) {
      returns.push({
        type_name: literal_type,
        confidence: 0.9,
        source: 'literal',
        location: node_to_location(ret)
      });
    }
    
    // Check if returning a variable
    const var_name = extract_variable_name(value, source);
    if (var_name) {
      // Look up variable type in type map
      const var_type = type_map.get(var_name);
      if (var_type) {
        returns.push({
          type_name: var_type.type_name,
          confidence: var_type.confidence * 0.9,  // Slightly less confident
          source: 'variable',
          location: node_to_location(ret)
        });
      }
    }
  }
  
  return returns;
}

// Merge multiple return types into union type
function merge_return_types(types: InferredReturnType[]): string {
  if (types.length === 0) return 'void';
  if (types.length === 1) return types[0].type_name;
  
  // Remove duplicates and void
  const unique = [...new Set(types
    .map(t => t.type_name)
    .filter(t => t !== 'void')
  )];
  
  if (unique.length === 0) return 'void';
  if (unique.length === 1) return unique[0];
  
  // Create union type
  return unique.join(' | ');
}
```

### 5. Language-Specific Patterns

- [ ] **TypeScript/JavaScript**:

```typescript
// Handle various return patterns
function patterns() {
  // Direct return
  return new User();
  
  // Conditional return
  return condition ? new Admin() : new User();
  
  // Async return
  async function create() {
    return new User();  // Returns Promise<User>
  }
  
  // Generator function
  function* generate() {
    yield new User();  // Generator<User>
  }
  
  // Arrow function
  const make = () => new Thing();
  
  // Method return
  class Factory {
    create() {
      return new Product();
    }
  }
}
```

- [ ] **Python**:

```python
# Python patterns
def create_user() -> None:  # Currently no type hint
    return User()  # Should infer -> User

async def async_create():
    return Admin()  # Should infer -> Awaitable[Admin]

def factory(type_name):
    if type_name == "admin":
        return Admin()
    return User()  # Should infer -> Union[Admin, User]

class Factory:
    def create(self):
        return Product()  # Method return type
```

- [ ] **Rust**:

```rust
// Rust patterns
fn create_user() -> _ {  // Type to be inferred
    User::new()  // Should infer -> User
}

fn factory(kind: &str) -> Box<dyn Base> {
    match kind {
        "admin" => Box::new(Admin::new()),
        _ => Box::new(User::new())
    }
}

async fn async_create() -> _ {
    Admin::new()  // Should infer -> impl Future<Output = Admin>
}

impl Factory {
    fn create(&self) -> _ {
        Product::new()  // Method return type
    }
}
```

### 6. Update Function Signatures

- [ ] Enrich function signatures with inferred return types:

```typescript
// New enrichment function
export function enrich_functions_with_return_types(
  functions: FunctionInfo[],
  return_type_map: FunctionReturnTypes,
  file_path: string
): FunctionInfo[] {
  return functions.map(func => {
    const func_key = build_function_key(func.name, func.location, file_path);
    const inferred_returns = return_type_map.return_types.get(func_key);
    
    if (inferred_returns && inferred_returns.length > 0) {
      // Merge multiple return types
      const merged_type = merge_return_types(inferred_returns);
      
      // Update function signature
      return {
        ...func,
        signature: {
          ...func.signature,
          return_type: func.signature.return_type || merged_type,
          inferred_return_type: merged_type,
          return_type_confidence: calculate_confidence(inferred_returns)
        },
        return_statements: inferred_returns.map(r => r.location)
      };
    }
    
    return func;
  });
}
```

## Testing Requirements

### Unit Tests

- [ ] Test basic return type inference:

```typescript
describe('Return type inference from constructors', () => {
  it('should infer return type from direct constructor return', () => {
    const source = `
      function createUser() {
        return new User();
      }
    `;
    
    const result = analyze_with_return_inference(source);
    const func = result.functions.find(f => f.name === 'createUser');
    
    expect(func.signature.inferred_return_type).toBe('User');
    expect(func.signature.return_type_confidence).toBeGreaterThan(0.9);
  });
  
  it('should handle multiple return paths', () => {
    const source = `
      function factory(type) {
        if (type === 'admin') {
          return new Admin();
        }
        return new User();
      }
    `;
    
    const result = analyze_with_return_inference(source);
    const func = result.functions.find(f => f.name === 'factory');
    
    expect(func.signature.inferred_return_type).toBe('Admin | User');
  });
  
  it('should handle async functions', () => {
    const source = `
      async function createAsync() {
        return new User();
      }
    `;
    
    const result = analyze_with_return_inference(source);
    const func = result.functions.find(f => f.name === 'createAsync');
    
    expect(func.signature.inferred_return_type).toBe('Promise<User>');
  });
  
  it('should handle arrow functions', () => {
    const source = `
      const createUser = () => new User();
    `;
    
    const result = analyze_with_return_inference(source);
    const func = result.functions.find(f => f.name === 'createUser');
    
    expect(func.signature.inferred_return_type).toBe('User');
  });
  
  it('should handle class methods', () => {
    const source = `
      class Factory {
        create() {
          return new Product();
        }
      }
    `;
    
    const result = analyze_with_return_inference(source);
    const method = result.classes[0].methods.find(m => m.name === 'create');
    
    expect(method.signature.inferred_return_type).toBe('Product');
  });
});
```

### Integration Tests

- [ ] Test cross-file return type inference:

```typescript
it('should infer return types across files', () => {
  const files = {
    'user.ts': 'export class User { }',
    'factory.ts': `
      import { User } from './user';
      export function create() {
        return new User();
      }
    `
  };
  
  const graph = analyze_project(files);
  const factory_file = graph.files.get('factory.ts');
  const create_func = factory_file.functions.find(f => f.name === 'create');
  
  expect(create_func.signature.inferred_return_type).toBe('User');
});
```

### Language-Specific Tests

- [ ] Python type inference:

```typescript
it('should infer Python return types', () => {
  const source = `
    def create_user():
        return User()
    
    async def async_create():
        return Admin()
  `;
  
  const result = analyze_python(source);
  
  expect(result.functions[0].signature.inferred_return_type).toBe('User');
  expect(result.functions[1].signature.inferred_return_type).toBe('Awaitable[Admin]');
});
```

- [ ] Rust type inference:

```typescript
it('should infer Rust return types', () => {
  const source = `
    fn create_user() -> _ {
        User::new()
    }
    
    async fn async_create() -> _ {
        Admin::new()
    }
  `;
  
  const result = analyze_rust(source);
  
  expect(result.functions[0].signature.inferred_return_type).toBe('User');
  expect(result.functions[1].signature.inferred_return_type).toBe('impl Future<Output = Admin>');
});
```

## Implementation Strategy

### Phase 1: Return Context Detection
1. Implement return statement detection
2. Find containing function for each return
3. Extract function metadata (name, async, etc.)

### Phase 2: Type Collection
1. Collect all return types per function
2. Handle conditional returns
3. Track confidence levels

### Phase 3: Type Merging
1. Merge multiple return types into unions
2. Handle void returns
3. Apply language-specific rules

### Phase 4: Signature Enrichment
1. Update function signatures with inferred types
2. Preserve explicitly declared types
3. Add confidence metrics

## Edge Cases

1. **Recursive Functions**:
   ```typescript
   function recursive(n) {
     if (n === 0) return new Base();
     return recursive(n - 1);  // Should still infer Base
   }
   ```

2. **Factory Functions with Maps**:
   ```typescript
   const factories = {
     user: () => new User(),
     admin: () => new Admin()
   };
   
   function create(type) {
     return factories[type]();  // Dynamic dispatch
   }
   ```

3. **Conditional Types**:
   ```typescript
   function create<T>(type: T) {
     return type === 'admin' ? new Admin() : new User();
   }
   ```

4. **Thrown Exceptions**:
   ```typescript
   function maybeCreate() {
     if (error) throw new Error();
     return new User();  // Only successful path returns User
   }
   ```

5. **Never Returns**:
   ```typescript
   function infinite() {
     while (true) {
       // Never returns
     }
   }
   ```

## Performance Considerations

1. **Cache Function Lookups**: Cache function key generation
2. **Lazy Evaluation**: Only compute return types when needed
3. **Incremental Updates**: Support updating single functions
4. **Limit Depth**: Set max depth for nested function analysis

## Success Metrics

- [ ] Return types inferred for functions returning constructors
- [ ] Multiple return paths handled correctly
- [ ] Async/generator functions handled appropriately
- [ ] Cross-file inference works
- [ ] No performance regression (< 5% slower)
- [ ] Confidence scores accurately reflect inference quality

## Future Enhancements

After this task:
1. **Literal Type Inference**: Infer from returned literals
2. **Variable Type Propagation**: Track returned variables
3. **Method Chain Inference**: `return new Builder().build()`
4. **Generic Return Types**: Infer generic type parameters
5. **Effect System**: Track side effects and purity

## Notes

- This creates a powerful feedback loop between constructor detection and type system
- Return type inference is a form of backward data flow analysis
- Consider interaction with explicitly typed functions
- May need iterative refinement for complex cases
- Confidence scoring helps when inference is uncertain

## References

- TODO locations: Multiple files in `/packages/core/src/type_analysis/type_tracking/`
- Constructor type extraction: task-epic-11.62.7
- Generic type parameters: task-epic-11.62.12
- Parent task: task-epic-11.62
- Architecture: `/docs/Architecture.md`