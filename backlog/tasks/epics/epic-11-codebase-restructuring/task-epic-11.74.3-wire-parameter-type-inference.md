# Task 11.74.3: Wire Parameter Type Inference into Layer 3

## Status: Created
**Priority**: CRITICAL
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Integration

## Summary

Wire the complete but unused `type_analysis/parameter_type_inference` module into Layer 3 (Local Type Analysis) of the Per-File phase. This module infers function parameter types from usage patterns and call sites.

## Context

The parameter type inference module is fully implemented with sophisticated inference from call sites, but is not connected to the file analyzer. This means:
- Function parameters remain untyped in dynamic languages
- Cannot validate function calls against inferred signatures
- Missing critical type information for undocumented code

## Problem Statement

Most JavaScript and Python code lacks explicit parameter type annotations:
```javascript
// Currently we don't infer parameter types
function processUser(user) {  // user type unknown
  return user.name.toUpperCase();  // But clearly user has .name property
}

processUser({ name: "John", age: 30 });  // Call site provides type info
```

## Success Criteria

- [ ] Parameter inference integrated into file_analyzer.ts Layer 3
- [ ] Parameter types inferred from function body usage
- [ ] Parameter types refined from call sites
- [ ] Inferred types stored in function signatures
- [ ] All types migrated to use @ariadnejs/types shared types
- [ ] Duplicate type definitions removed and consolidated
- [ ] Tests demonstrate inference for all languages

## Technical Approach

### Integration Point

**File**: `packages/core/src/file_analyzer.ts`
**Location**: In `analyze_local_types()` function
**Layer**: 3 - Local Type Analysis (Per-File Phase)

### Implementation Steps

1. **Import the module**:
```typescript
import {
  infer_parameter_types,
  infer_from_call_sites,
  infer_from_body_usage,
  format_inferred_signature
} from "./type_analysis/parameter_type_inference";
```

2. **Add inference to Layer 3**:
```typescript
function analyze_local_types(
  source_code: string,
  root_node: SyntaxNode,
  file: CodeFile,
  scopes: ScopeTree,
  imports: ImportInfo[],
  class_definitions: ClassDefinition[]
): Layer3Results {
  const type_tracking_context: TypeTrackingContext = {
    language: file.language,
    file_path: file.file_path,
    debug: false,
  };
  
  const type_tracker = process_file_for_types(
    source_code,
    root_node,
    type_tracking_context
  );
  
  // NEW: Infer parameter types
  const parameter_inference_context = {
    language: file.language,
    file_path: file.file_path,
    scopes,
    type_tracker,
    source_code
  };
  
  const inferred_parameters = infer_all_parameter_types(
    root_node,
    parameter_inference_context
  );
  
  // Merge inferred parameters into type tracker
  merge_parameter_types(type_tracker, inferred_parameters);
  
  return { 
    type_tracker,
    inferred_parameters  // NEW field
  };
}
```

3. **Create inference function**:
```typescript
function infer_all_parameter_types(
  root_node: SyntaxNode,
  context: ParameterInferenceContext
): Map<string, InferredParameters> {
  const inferred = new Map();
  
  // Find all function definitions
  const functions = find_all_functions(root_node, context.language);
  
  for (const func of functions) {
    // Infer from parameter usage in function body
    const body_inference = infer_from_body_usage(
      func,
      context.source_code,
      context
    );
    
    // Find call sites for this function
    const call_sites = find_function_calls_to(
      func.name,
      root_node,
      context.source_code
    );
    
    // Infer from call site arguments
    const call_inference = infer_from_call_sites(
      call_sites,
      context
    );
    
    // Combine inferences
    const combined = combine_parameter_inferences(
      body_inference,
      call_inference
    );
    
    inferred.set(func.name, combined);
  }
  
  return inferred;
}
```

4. **Update function signatures with inferred types**:
```typescript
// In extract_definitions() Layer 6
function extract_definitions(
  root_node: SyntaxNode,
  source_code: string,
  file: CodeFile,
  scopes: ScopeTree,
  class_definitions: ClassDefinition[],
  inferred_parameters: Map<string, InferredParameters>  // NEW
): Layer6Results {
  // ... existing code ...
  
  for (const func_info of functions) {
    // Apply inferred parameter types
    const inferred = inferred_parameters.get(func_info.name);
    if (inferred) {
      func_info.signature.parameters = merge_with_inferred(
        func_info.signature.parameters,
        inferred
      );
    }
  }
  
  // ... rest of function ...
}
```

## Type Review Requirements

### CRITICAL: Use Shared Types from @ariadnejs/types

During implementation, review ALL type definitions to ensure:

1. **Use shared types** from `@ariadnejs/types` package:
   - `ParameterType`, `FunctionSignature`, `TypeInfo`
   - `InferredType`, `TypeConfidence` (if they exist)
   - `Location`, `Position`, `Range`
   - Any other types that exist in the shared package

2. **Remove duplicate definitions**:
   - Check if local types duplicate shared types
   - Replace local interfaces with shared ones
   - Delete redundant type definitions

3. **Type migration checklist**:
   - [ ] Audit all imports - use `@ariadnejs/types` where possible
   - [ ] Check for local `interface` or `type` definitions that duplicate shared types
   - [ ] Verify `InferredParameters` type exists in shared types or create it
   - [ ] Ensure `ParameterInferenceContext` uses shared base types
   - [ ] Remove any ad-hoc type definitions that should be shared

4. **Common duplications to watch for**:
   - `FunctionSignature`, `ParameterType` - use shared
   - `TypeInfo`, `TypeAnnotation` - use shared
   - `ScopeTree`, `Symbol` - use shared
   - Custom inference-related types that might already exist

### Example Migration

```typescript
// BEFORE: Local type definition
interface InferredParameter {
  name: string;
  type: string;
  confidence: number;
}

// AFTER: Use shared type
import { InferredParameter } from '@ariadnejs/types';
// Or if it doesn't exist, add to @ariadnejs/types first
```

## Dependencies

- Requires scope tree for context
- Should run after type_tracking
- Must run before function extraction (Layer 6)

## Testing Requirements

### Unit Tests
```typescript
test("infers parameter type from property access", () => {
  const code = `
    function getName(user) {
      return user.name;
    }
  `;
  // Should infer user has 'name' property
});

test("infers parameter type from method calls", () => {
  const code = `
    function process(value) {
      return value.toString().toUpperCase();
    }
  `;
  // Should infer value has toString() method
});
```

### Integration Tests
```typescript
test("combines inference from multiple call sites", () => {
  const code = `
    function process(data) {
      return data.value * 2;
    }
    
    process({ value: 10 });
    process({ value: 20, extra: true });
  `;
  // Should infer data: { value: number, extra?: boolean }
});
```

### Language-Specific Tests
- JavaScript: Duck typing patterns
- TypeScript: Partial inference with some annotations
- Python: Usage-based typing
- Rust: Inference with trait bounds

## Risks

1. **Ambiguity**: Multiple possible types from different call sites
2. **Incomplete**: May not catch all parameter usage patterns
3. **Performance**: Analyzing all call sites could be expensive

## Implementation Notes

### Inference Strategy
1. **From body**: Analyze how parameters are used
   - Property access → object with properties
   - Method calls → object with methods
   - Operators → primitive types

2. **From call sites**: Analyze actual arguments
   - Literal values → concrete types
   - Variable arguments → traced types
   - Object literals → shape types

3. **Combination**: Merge and refine
   - Intersection of requirements from body
   - Union of possibilities from call sites
   - Confidence scoring for ambiguous cases

### Module Exports to Use
- `infer_parameter_types()` - Main inference function
- `infer_from_call_sites()` - Call site analysis
- `infer_from_body_usage()` - Body usage analysis
- `format_inferred_signature()` - Format for display

### Expected Improvements
- Functions gain typed parameters without annotations
- Better IDE support for parameter hints
- Call site validation against inferred signatures
- Documentation generation with inferred types

## Estimated Effort

- Implementation: 1 day
- Testing: 0.5 days
- Integration: 0.5 days
- **Total**: 2 days

## Notes

Parameter type inference is crucial for analyzing dynamic languages. Most JavaScript/Python code lacks type annotations, but the usage patterns clearly indicate the expected types. This module extracts that implicit type information, making it explicit for downstream analysis.