# Task 11.100.0.5.23.5: Complete High-Impact Function Updates

## Parent Task  
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority
**MEDIUM** - Completes the core function parameter refactoring

## Issue Summary
The original Symbol Refactor task identified many high-impact functions needing SymbolId parameter updates, but only Phase 1 functions were completed.

## Scope
Complete the remaining function parameter updates identified in the original task analysis.

## Work Required

### Phase 2A: Type Tracking Functions (INCOMPLETE)
**Status**: Only `set_variable_type` was completed in Phase 1
- [ ] `get_variable_type(var_name: string)` → `get_variable_type(symbol: SymbolId)`
- [ ] `track_assignment(var_name: string)` → `track_assignment(symbol: SymbolId)`

### Phase 2B: Symbol Resolution Functions (PARTIALLY COMPLETE)
**Status**: Core functions done, remaining functions still need updates
- [ ] `resolve_reference(name: string)` → `resolve_reference(symbol: SymbolId)`
- [ ] `get_symbol_definition(name: string)` → `get_symbol_definition(symbol: SymbolId)`

### Phase 2C: Method Resolution Functions (PARTIALLY COMPLETE)  
**Status**: `resolve_method_in_hierarchy` done, remaining functions need updates
- [ ] `find_override(base_class: string, method: string)` → `find_override(base_class: SymbolId, method: SymbolId)`
- [ ] `check_implementation(interface_name: string, method: string)` → `check_implementation(interface: SymbolId, method: SymbolId)`

### Phase 2D: Import/Export Functions (PARTIALLY COMPLETE)
**Status**: `is_symbol_exported` done, remaining functions need updates  
- [ ] `imports_symbol(imp: Import, symbol: string)` → `imports_symbol(imp: Import, symbol: SymbolId)`
- [ ] `exports_symbol(exp: Export, symbol: string)` → `exports_symbol(exp: Export, symbol: SymbolId)`
- [ ] `resolve_import(module: string, symbol: string)` → `resolve_import(module: ModulePath, symbol: SymbolId)`

### Phase 2E: Call Graph Functions
**Status**: Not started - identified during implementation
- [ ] Survey call graph modules for string identifier parameters
- [ ] Update constructor_calls functions beyond import fixes
- [ ] Update function_calls and method_calls modules

## Implementation Strategy

### Use Proven Overload Pattern
Continue using the dual signature approach proven successful in Phase 1:
```typescript
function resolve_reference(symbol: SymbolId): ResolvedReference | undefined;
function resolve_reference(name: string): ResolvedReference | undefined;  
function resolve_reference(nameOrSymbol: string | SymbolId): ResolvedReference | undefined {
  const symbol = typeof nameOrSymbol === 'string' && !nameOrSymbol.includes(':')
    ? (nameOrSymbol as unknown as SymbolId)  // Simple conversion
    : nameOrSymbol as SymbolId;
  // Implementation uses symbol
}
```

### Migration Timeline
- **Phase 2A-2D**: High-priority functions (2-3 days)
- **Phase 2E**: Call graph functions (1-2 days)  
- **Verification**: Test all overloads work correctly (1 day)

## Success Criteria
- ✅ All identified high-impact functions have SymbolId overloads
- ✅ Backward compatibility maintained with string overloads
- ✅ Performance impact minimal (only legacy string calls affected)
- ✅ No breaking changes to existing call sites
- ✅ Documentation updated for new preferred signatures

## Files to Update
**Type Tracking**:
- `packages/core/src/type_analysis/type_tracking/type_tracking.ts`

**Symbol Resolution**:  
- `packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.ts`

**Method Resolution**:
- `packages/core/src/call_graph/method_calls/method_hierarchy_resolver.ts`

**Import/Export**:
- `packages/core/src/import_export/export_detection/index.ts`
- `packages/core/src/import_export/import_resolution/import_resolution.ts`

**Call Graph** (to be surveyed):
- `packages/core/src/call_graph/function_calls/`
- `packages/core/src/call_graph/method_calls/`
- `packages/core/src/call_graph/constructor_calls/`

## Dependencies
**Requires**: Task 11.100.0.5.23.4 (Type Tracking Export Issues) completion for type tracking functions

## Estimated Time
4-6 days total

## Risk Assessment
- **Low Risk**: Pattern proven successful in Phase 1
- **Mitigation**: Use same overload approach, test incrementally

## Notes
This task completes the original vision for Symbol Refactor Task 23. After completion, ~90% of high-impact identifier parameters will use SymbolId, setting the stage for eventual removal of legacy string overloads.