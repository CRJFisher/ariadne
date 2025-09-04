# Task Epic-11.80.4: Integrate scope_tree for Local Symbol Resolution

## Status

Completed

## Parent Task

Epic-11.80: Enhance function_calls with Configuration Pattern and Integrations

## Description

Add scope_tree to FunctionCallContext and use it to resolve local function definitions, improving call target identification within the same file.

## Implementation Details

### 1. Update Context Interface

```typescript
interface FunctionCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
  scope_tree?: ScopeTree; // NEW: Optional for backward compatibility
}
```

### 2. Use Scope Tree for Resolution

```typescript
function resolve_local_function(
  callee_name: string,
  call_location: Location,
  scope_tree: ScopeTree
): SymbolId | null {
  // Find the scope containing the call
  const call_scope = find_scope_at_location(scope_tree, call_location);

  // Walk up scope chain looking for function definition
  return find_symbol_in_scope_chain(call_scope, callee_name, "function");
}
```

### 3. Enhance Call Info

```typescript
interface EnhancedFunctionCallInfo extends FunctionCallInfo {
  resolved_target?: {
    symbol_id: SymbolId;
    definition_location: Location;
    is_local: boolean;
  };
}
```

## Benefits

- Accurate local function resolution
- Distinguish between local and external calls
- Better understanding of scope context
- Foundation for "find references" functionality

## Acceptance Criteria

- [x] Scope tree is available in context
- [x] Local functions are correctly resolved
- [x] Call info includes resolved target when available
- [x] Backward compatibility maintained
- [x] Tests verify resolution accuracy

## Dependencies

- Task 11.80.1 (configuration pattern should be in place)

## Estimated Effort

3 hours

## Important Note

This task should only be started after comprehensive testing (11.80.3) is complete. Adding enhancements without a solid test baseline will lead to regressions.

## Implementation Notes

Completed implementation with the following changes:

1. **Added scope_tree to FunctionCallContext** - Made it an optional field for backward compatibility
2. **Created EnhancedFunctionCallInfo interface** - Extends FunctionCallInfo with optional resolved_target field
3. **Implemented resolve_local_function** - Resolves function calls to local definitions using scope tree
4. **Fixed scope tree bugs**:
   - Fixed reversed parameters in location_contains call in scope_tree.ts
   - Fixed location field (was using 'range') in JavaScript scope tree builder
5. **Implemented proper point-in-range checking** - Created helper functions to check if a call location is within a scope
6. **Added comprehensive test** - Test verifies that local functions are resolved while unknown functions are not

### Key Technical Decisions

- Used the start position of calls for scope lookup (not the entire call range) to handle multi-column expressions
- Created custom point_in_range and find_scope_for_location functions for more accurate scope finding
- Maintained backward compatibility by making scope_tree optional in context

### Files Modified

- `/packages/core/src/call_graph/function_calls/function_calls.ts` - Main implementation
- `/packages/core/src/call_graph/function_calls/index.ts` - Export EnhancedFunctionCallInfo
- `/packages/core/src/call_graph/function_calls/function_calls.test.ts` - Added integration test
- `/packages/core/src/scope_analysis/scope_tree/scope_tree.ts` - Fixed location_contains bug
- `/packages/core/src/scope_analysis/scope_tree/scope_tree.javascript.ts` - Fixed location field
