# Task Epic-11.80.4: Integrate scope_tree for Local Symbol Resolution

## Status
Pending

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
  scope_tree?: ScopeTree;  // NEW: Optional for backward compatibility
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
  return find_symbol_in_scope_chain(call_scope, callee_name, 'function');
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
- [ ] Scope tree is available in context
- [ ] Local functions are correctly resolved
- [ ] Call info includes resolved target when available
- [ ] Backward compatibility maintained
- [ ] Tests verify resolution accuracy

## Dependencies
- Task 11.80.1 (configuration pattern should be in place)

## Estimated Effort
3 hours

## Important Note

This task should only be started after comprehensive testing (11.80.3) is complete. Adding enhancements without a solid test baseline will lead to regressions.
