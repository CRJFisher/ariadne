# Task 11.74.1: Wire Generic Type Resolution into Layer 7

## Status: Created
**Priority**: CRITICAL
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Integration

## Summary

Wire the complete but unused `type_analysis/generic_resolution` module into Layer 7 (Cross-File Type Resolution) of the Global Assembly phase. This module can resolve generic type parameters with concrete types, a critical gap in the current pipeline.

## Context

The generic resolution module is fully implemented with support for TypeScript, Rust, and Python generics, but sits completely disconnected from the processing pipeline. This means we cannot:
- Resolve `Array<T>` to `Array<string>` when T is known
- Track type parameter constraints
- Handle variance in generic types
- Resolve generic method calls correctly

## Problem Statement

Generic types are pervasive in modern codebases:
- TypeScript: `Promise<T>`, `Array<T>`, custom generics
- Rust: `Vec<T>`, `Option<T>`, `Result<T, E>`
- Python: `List[T]`, `Dict[K, V]`, `Optional[T]`

Without generic resolution, our type analysis is fundamentally incomplete.

## Success Criteria

- [ ] Generic resolution integrated into code_graph.ts Layer 7
- [ ] Generic parameters resolved during global type resolution
- [ ] Type constraints validated across file boundaries
- [ ] Generic instantiations tracked in type registry
- [ ] Tests passing for all supported languages

## Technical Approach

### Integration Point

**File**: `packages/core/src/code_graph.ts`
**Location**: After type registry building, before symbol resolution
**Layer**: 7 - Cross-File Type Resolution (currently TODO)

### Implementation Steps

1. **Import the module**:
```typescript
import { 
  extract_generic_parameters,
  resolve_language_generic,
  is_generic_parameter,
  instantiate_generic_type
} from "./type_analysis/generic_resolution";
```

2. **Add resolution phase after type registry**:
```typescript
// Layer 7: Cross-File Type Resolution
const generic_resolution_context = {
  type_registry,
  class_hierarchy,
  module_graph: modules
};

// Resolve generic types across all analyses
for (const analysis of enriched_analyses) {
  const resolved_generics = resolve_file_generics(
    analysis,
    generic_resolution_context
  );
  
  // Merge resolved generics back into analysis
  analysis.resolved_types = {
    ...analysis.resolved_types,
    generics: resolved_generics
  };
}
```

3. **Create helper function**:
```typescript
function resolve_file_generics(
  analysis: FileAnalysis,
  context: GenericResolutionContext
): Map<string, ResolvedGeneric> {
  const resolved = new Map();
  
  // Extract generic parameters from classes
  for (const cls of analysis.classes) {
    if (cls.type_parameters.length > 0) {
      const params = extract_generic_parameters(
        cls,
        analysis.language
      );
      // Store in resolved map
    }
  }
  
  // Resolve generic instantiations in method calls
  for (const call of analysis.method_calls) {
    if (call.type_arguments) {
      const resolved_type = resolve_language_generic(
        call.type_arguments,
        context,
        analysis.language
      );
      resolved.set(call.id, resolved_type);
    }
  }
  
  return resolved;
}
```

4. **Update type registry with resolved generics**:
```typescript
// Store resolved generics in type registry
for (const [key, resolved] of all_resolved_generics) {
  type_registry.generics.set(key, resolved);
}
```

## Dependencies

- Requires type_registry to be built first
- Should run before symbol resolution
- May need updates to FileAnalysis type to store resolved generics

## Testing Requirements

### Unit Tests
- Test generic parameter extraction
- Test constraint validation
- Test instantiation with concrete types

### Integration Tests
```typescript
// Test cross-file generic resolution
test("resolves generic type from imported module", () => {
  // File A: export class Container<T> { }
  // File B: import { Container } from './a';
  //         const c: Container<string>;
  // Should resolve Container<string> correctly
});
```

### Language-Specific Tests
- TypeScript: Mapped types, conditional types
- Rust: Associated types, lifetime parameters
- Python: TypeVar, Generic base class

## Risks

1. **Performance**: Generic resolution adds another pass
2. **Complexity**: Generic variance rules differ by language
3. **Incompleteness**: May not handle all generic patterns initially

## Implementation Notes

### Order of Operations
1. Build type registry (existing)
2. Build class hierarchy (existing)
3. **NEW: Resolve generics** ← Wire here
4. Resolve types (partial/stub)
5. Build symbol table (existing)

### Module Exports to Use
- `extract_generic_parameters()` - Get generic params from definitions
- `resolve_language_generic()` - Main resolution dispatcher
- `is_generic_parameter()` - Check if type is generic
- `instantiate_generic_type()` - Replace type params with concrete types

### Expected Improvements
- Method calls on generic types will resolve correctly
- Type propagation will handle generic containers
- Cross-file generic usage will be tracked

## Estimated Effort

- Implementation: 1 day
- Testing: 0.5 days
- Integration debugging: 0.5 days
- **Total**: 2 days

## Notes

This is one of the most critical missing pieces. The module is complete and tested in isolation, but provides zero value until wired into the pipeline. Priority should be CRITICAL as it blocks accurate type analysis for modern codebases.