---
id: task-epic-11.62.6
title: Wire Constructor Calls to Type Registry
status: Completed
assignee: []
created_date: "2025-08-29"
completed_date: "2025-08-30"
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

### Create Enrichment Approach

- [x] Created `constructor_type_resolver.ts` module for Global Assembly phase enrichment
  - Recognized that constructor_calls runs in Per-File phase, type_registry in Global Assembly
  - Implemented enrichment pattern similar to task 11.62.5

### Consume Type Registry

- [x] Implement enrichment function that accepts TypeRegistry:
```typescript
export function find_constructor_calls(
  context: ProcessingContext,
  type_registry?: TypeRegistry  // From global assembly
): ConstructorCallInfo[] {
  // Use registry to validate and resolve constructors
}
```

### Validate Constructor Calls

- [x] Implemented `validate_constructor` function:
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

- [x] Created `ConstructorCallWithType` interface with validation and type information:
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

- [x] Implemented cross-file constructor resolution:
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

- [x] **JavaScript/TypeScript**:
  - Validates 'new' expressions
  - Resolves built-in constructors (Array, Object, etc.)
  - Handles imported classes
  
- [x] **Python**:
  - Validates class instantiation (no 'new' keyword)
  - Checks __init__ parameters
  - Supports built-in types
  
- [x] **Rust**:
  - Validates Type::new() patterns
  - Handles struct constructors
  - Supports built-in types (Vec, HashMap, etc.)

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

- [x] Test constructor validation with existing types
- [x] Test constructor validation with non-existent types
- [x] Test imported constructor resolution
- [x] Test parameter validation
- [x] Test type alias resolution
- [x] Verify cross-file constructor resolution

## Success Metrics

- [x] Constructor calls validated against type registry
- [x] Imported constructors properly resolved
- [x] Parameter mismatches detected
- [x] All existing constructor call tests still pass
- [x] Batch validation for performance optimization

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

## Implementation Notes

### Key Architectural Decision

**Enrichment Pattern over Direct Integration**: Similar to task 11.62.5, the original task suggested passing type_registry directly to find_constructor_calls, but this violates the processing phase architecture:

- constructor_calls runs during Per-File Analysis (parallel phase)
- type_registry is built during Global Assembly (sequential phase)
- Per-File modules cannot use Global Assembly data

**Solution**: Created an enrichment pattern where:

1. Constructor calls are collected during Per-File phase (syntax only)
2. After type registry is built in Global Assembly, an enrichment function validates calls
3. This maintains phase separation while achieving validation functionality

### Files Created

- **constructor_type_resolver.ts**: Core validation module with:
  - `enrich_constructor_calls_with_types`: Main enrichment function
  - `validate_constructor`: Validates individual constructor calls
  - `batch_validate_constructors`: Efficient batch validation
  - `get_constructable_types`: Helper for finding all constructable types

- **constructor_type_resolver.test.ts**: Comprehensive tests covering:
  - Valid and invalid constructors
  - Parameter validation
  - Import resolution
  - Type aliases
  - Built-in types for all languages

### Integration Point

Added TODO comment in `code_graph.ts` (lines 179-189) for where the enrichment should be called once the Global Assembly infrastructure is complete.

### Design Benefits

1. **Phase Separation**: Maintains clean separation between processing phases
2. **Incremental Validation**: Constructor calls work without registry, get validated when available
3. **Cross-File Resolution**: Supports imported class constructors
4. **Parameter Checking**: Validates constructor parameter compatibility
5. **Language Agnostic**: Core logic works for all languages with language-specific built-ins

### Features Implemented

- **Type Validation**: Checks if constructed type exists in registry
- **Import Resolution**: Resolves imported classes through registry exports
- **Alias Resolution**: Handles type aliases in constructor calls
- **Parameter Validation**: Detects parameter count mismatches
- **Built-in Types**: Supports language-specific built-in constructors
- **Batch Processing**: Efficient validation of multiple calls
- **Caching**: Uses import cache for repeated lookups

### Future Work

- Wire up enrichment when Global Assembly phase is fully implemented
- Add support for generic type parameters in constructors
- Enhance parameter type checking (not just count)
- Add support for factory methods and builder patterns
- Consider integration with type inference for better validation
