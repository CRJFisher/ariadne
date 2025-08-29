---
id: task-epic-11.62.6
title: Wire Constructor Calls to Type Registry
status: To Do
assignee: []
created_date: "2025-08-29"
labels: [epic-11, sub-task, integration, type-validation]
dependencies: [task-epic-11.62.1, task-epic-11.62.2, task-epic-11.61]
parent_task_id: task-epic-11.62
---

## Description

Wire the constructor_calls module to use type_registry for validating constructor calls and resolving class types. This ensures constructor calls reference valid types and enables cross-file constructor resolution.

## Current Problem

Without type registry access, constructor_calls cannot:
- Validate that constructed types actually exist
- Resolve imported class constructors
- Track constructor parameter types
- Handle type aliases in constructor calls

## Acceptance Criteria

### Consume Type Registry

- [ ] Update constructor_calls to accept TypeRegistry from context:
```typescript
export function find_constructor_calls(
  context: ProcessingContext,
  type_registry?: TypeRegistry  // From global assembly
): ConstructorCallInfo[] {
  // Use registry to validate and resolve constructors
}
```

### Validate Constructor Calls

- [ ] Implement constructor validation:
```typescript
function validate_constructor(
  class_name: string,
  type_registry: TypeRegistry,
  file_path: string
): ClassDefinition | undefined {
  // Check if type exists in registry
  const type_def = type_registry.lookup_type(class_name, file_path);
  
  if (type_def && type_def.kind === 'class') {
    return type_def as ClassDefinition;
  }
  
  // Check if it's an imported type
  const imported = type_registry.resolve_import(class_name, file_path);
  if (imported && imported.kind === 'class') {
    return imported as ClassDefinition;
  }
  
  return undefined;
}
```

### Enhanced Constructor Call Info

- [ ] Include validation and type information:
```typescript
export interface ConstructorCallInfo {
  // existing fields...
  is_valid?: boolean;           // Whether type exists in registry
  resolved_type?: string;        // Fully qualified type name
  expected_params?: Parameter[]; // Expected constructor parameters
  param_mismatch?: boolean;      // If params don't match signature
}
```

### Cross-File Resolution

- [ ] Resolve constructors across module boundaries:
```typescript
function resolve_constructor_type(
  identifier: string,
  imports: ImportInfo[],
  type_registry: TypeRegistry,
  file_path: string
): string | undefined {
  // Check if it's an imported class
  const import_info = imports.find(i => 
    i.name === identifier || i.alias === identifier
  );
  
  if (import_info) {
    // Resolve through type registry
    const qualified_name = type_registry.get_qualified_name(
      import_info.source,
      import_info.name
    );
    return qualified_name;
  }
  
  // Check local types
  return type_registry.lookup_local_type(identifier, file_path);
}
```

### Language-Specific Patterns

- [ ] **JavaScript/TypeScript**:
  - Handle 'new' expressions
  - Resolve constructor functions
  - Track class expressions
  
- [ ] **Python**:
  - Handle class instantiation (no 'new' keyword)
  - Resolve __init__ parameters
  - Track metaclass instantiation
  
- [ ] **Rust**:
  - Handle Type::new() patterns
  - Resolve associated functions
  - Track struct literals

## Implementation Example

```typescript
// In constructor_calls.typescript.ts
export function find_constructor_calls_typescript(
  context: ProcessingContext,
  type_registry?: TypeRegistry
): ConstructorCallInfo[] {
  const { ast, source, file_path } = context.layer0;
  const imports = context.layer2?.imports || [];
  const constructor_calls: ConstructorCallInfo[] = [];
  
  ast.descendantsOfType('new_expression').forEach(node => {
    const constructor = node.childForFieldName('constructor');
    
    if (constructor) {
      const class_name = get_node_text(constructor, source);
      
      let is_valid = false;
      let resolved_type: string | undefined;
      let expected_params: Parameter[] = [];
      let param_mismatch = false;
      
      if (type_registry) {
        // Resolve the constructor type
        resolved_type = resolve_constructor_type(
          class_name,
          imports,
          type_registry,
          file_path
        );
        
        // Validate it exists
        const class_def = resolved_type
          ? type_registry.get_type(resolved_type)
          : undefined;
          
        if (class_def && class_def.kind === 'class') {
          is_valid = true;
          
          // Get constructor parameters
          const ctor = class_def.methods.find(m => 
            m.name === 'constructor' || m.name === '__init__'
          );
          
          if (ctor) {
            expected_params = ctor.parameters;
            
            // Check parameter count
            const args = node.childForFieldName('arguments');
            const actual_count = args?.namedChildCount || 0;
            const expected_count = expected_params.filter(
              p => !p.is_optional
            ).length;
            
            param_mismatch = actual_count < expected_count;
          }
        }
      }
      
      constructor_calls.push({
        class_name,
        location: node_to_location(node),
        arguments: extract_arguments(node, source),
        is_valid,
        resolved_type,
        expected_params,
        param_mismatch,
        language: 'typescript',
        file_path
      });
    }
  });
  
  return constructor_calls;
}
```

## Testing Requirements

- [ ] Test constructor validation with existing types
- [ ] Test constructor validation with non-existent types
- [ ] Test imported constructor resolution
- [ ] Test parameter validation
- [ ] Test type alias resolution
- [ ] Verify cross-file constructor resolution

## Success Metrics

- [ ] Constructor calls validated against type registry
- [ ] Imported constructors properly resolved
- [ ] Parameter mismatches detected
- [ ] All existing constructor call tests still pass
- [ ] Integration test shows cross-file validation working

## Notes

- Depends on type_registry being implemented (task 11.61)
- Type registry is populated in global assembly phase
- May need two-pass: collect calls first, validate after registry built
- Consider caching type lookups for performance

## References

- Parent task: task-epic-11.62
- Constructor calls module: `/packages/core/src/call_graph/constructor_calls/`
- Type registry: `/packages/core/src/type_analysis/type_registry/`
- Depends on: task-epic-11.61 (type registry must be implemented)
- Processing pipeline: `/docs/PROCESSING_PIPELINE.md` (Layer 4 uses Layer 6 data)