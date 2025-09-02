# Task 11.74.4: Wire Return Type Inference into Layer 3

## Status: Created
**Priority**: CRITICAL
**Parent**: Task 11.74 - Wire and Consolidate Unwired Modules
**Type**: Module Integration

## Summary

Wire the complete but unused `type_analysis/return_type_inference` module into Layer 3 (Local Type Analysis) of the Per-File phase. Note: This module is partially wired in Layer 6 but not properly integrated into Layer 3 where it belongs.

## Context

Return type inference is partially used in `extract_definitions()` (Layer 6) but is not properly integrated into the type analysis layer where it should build comprehensive return type information. The current integration is ad-hoc and misses critical inference opportunities.

## Problem Statement

Current integration problems:
1. Inference happens too late (Layer 6 instead of Layer 3)
2. No coordination with parameter type inference
3. Missing async/generator return type handling
4. No cross-function return type propagation

## Success Criteria

- [ ] Return type inference moved to Layer 3
- [ ] Coordinates with parameter type inference (11.74.3)
- [ ] Handles async/generator/promise returns
- [ ] Return types available for type propagation
- [ ] Layer 6 uses pre-computed return types

## Technical Approach

### Integration Point

**File**: `packages/core/src/file_analyzer.ts`
**Location**: In `analyze_local_types()` function, after parameter inference
**Layer**: 3 - Local Type Analysis

### Implementation Steps

1. **Import properly in file_analyzer.ts**:
```typescript
import {
  infer_function_return_type,
  analyze_function_returns,
  infer_async_return_type,
  infer_generator_yield_type,
  build_return_type_map
} from "./type_analysis/return_type_inference";
```

2. **Move inference to Layer 3**:
```typescript
function analyze_local_types(
  source_code: string,
  root_node: SyntaxNode,
  file: CodeFile,
  scopes: ScopeTree,
  imports: ImportInfo[],
  class_definitions: ClassDefinition[]
): Layer3Results {
  // ... existing type tracking ...
  
  // ... parameter inference from 11.74.3 ...
  
  // NEW: Comprehensive return type inference
  const return_type_context = {
    language: file.language,
    file_path: file.file_path,
    source_code,
    scopes,
    type_tracker,
    inferred_parameters  // Use parameter types for better inference
  };
  
  const inferred_returns = infer_all_return_types(
    root_node,
    return_type_context
  );
  
  // Store in type tracker for propagation
  type_tracker.return_types = inferred_returns;
  
  return {
    type_tracker,
    inferred_parameters,
    inferred_returns  // NEW field
  };
}
```

3. **Create comprehensive inference**:
```typescript
function infer_all_return_types(
  root_node: SyntaxNode,
  context: ReturnTypeContext
): Map<string, InferredReturnType> {
  const returns = new Map();
  
  // Find all functions (including nested, arrow, async, generators)
  const functions = find_all_function_nodes(
    root_node,
    context.language
  );
  
  for (const func of functions) {
    const analysis = analyze_function_returns(
      func,
      context
    );
    
    let return_type: TypeInfo;
    
    if (analysis.is_async) {
      // Infer Promise<T> where T is the resolved type
      return_type = infer_async_return_type(
        analysis.returns,
        context
      );
    } else if (analysis.is_generator) {
      // Infer Generator<T, TReturn, TNext>
      return_type = infer_generator_yield_type(
        analysis.yields,
        analysis.returns,
        context
      );
    } else {
      // Regular return type inference
      return_type = infer_function_return_type(
        func,
        context
      );
    }
    
    // Handle early returns and multiple return paths
    if (analysis.has_multiple_returns) {
      return_type = create_union_type(
        analysis.return_types,
        context
      );
    }
    
    returns.set(func.id, {
      type: return_type,
      is_async: analysis.is_async,
      is_generator: analysis.is_generator,
      confidence: analysis.confidence
    });
  }
  
  return returns;
}
```

4. **Update Layer 6 to use pre-computed types**:
```typescript
function extract_definitions(
  root_node: SyntaxNode,
  source_code: string,
  file: CodeFile,
  scopes: ScopeTree,
  class_definitions: ClassDefinition[],
  inferred_parameters: Map<string, InferredParameters>,
  inferred_returns: Map<string, InferredReturnType>  // NEW
): Layer6Results {
  // ... existing code ...
  
  for (const func_info of functions) {
    // Use pre-computed return type instead of re-inferring
    const return_info = inferred_returns.get(func_info.id);
    if (return_info) {
      func_info.signature.return_type = return_info.type;
      func_info.signature.is_async = return_info.is_async;
      func_info.signature.is_generator = return_info.is_generator;
    }
    
    // No more inline inference needed
    // DELETE: const inferred_return_type = infer_function_return_type(...)
  }
}
```

## Dependencies

- Should run after parameter type inference (11.74.3)
- Coordinates with type_tracker
- Must complete before Layer 6 definition extraction

## Testing Requirements

### Unit Tests
```typescript
test("infers return type from return statements", () => {
  const code = `
    function getValue() {
      if (condition) return "string";
      return 42;
    }
  `;
  // Should infer: string | number
});

test("infers async function return types", () => {
  const code = `
    async function fetchData() {
      const response = await fetch(url);
      return response.json();
    }
  `;
  // Should infer: Promise<any> (or specific type if fetch is typed)
});
```

### Integration Tests
```typescript
test("coordinates with parameter types for better inference", () => {
  const code = `
    function transform(input) {
      return input.map(x => x * 2);
    }
    
    transform([1, 2, 3]);
  `;
  // Parameter inference: input is number[]
  // Return inference: number[] (from map return)
});
```

### Language-Specific Tests
- JavaScript: Implicit returns, arrow functions
- TypeScript: Async/await, generators
- Python: Multiple return, yield
- Rust: Result<T, E>, Option<T>

## Risks

1. **Complexity**: Multiple return paths create union types
2. **Recursion**: Recursive functions need special handling
3. **Performance**: Deep analysis of all paths could be slow

## Implementation Notes

### Return Type Analysis

1. **Explicit returns**: Direct type from return expression
2. **Implicit returns**: Last expression (arrow functions)
3. **Early returns**: Union of all return types
4. **No return**: void/undefined/None
5. **Async returns**: Wrapped in Promise/Future
6. **Generator yields**: Generator/Iterator types

### Module Exports to Use
- `infer_function_return_type()` - Main inference
- `analyze_function_returns()` - Find all return paths
- `infer_async_return_type()` - Async function handling
- `infer_generator_yield_type()` - Generator handling

### Expected Improvements
- Complete function signatures with return types
- Better type propagation through function calls
- Async/await chain type tracking
- Generator iteration type safety

## Estimated Effort

- Implementation: 1 day
- Refactor Layer 6: 0.5 days
- Testing: 0.5 days
- **Total**: 2 days

## Notes

This is partially a refactoring task - moving existing functionality to the correct layer and expanding it. The current ad-hoc integration in Layer 6 should be completely replaced with pre-computed return types from Layer 3. This will also enable better coordination with parameter type inference for more accurate signatures.