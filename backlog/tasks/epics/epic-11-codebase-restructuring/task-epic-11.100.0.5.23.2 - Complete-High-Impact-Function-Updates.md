# Task 11.100.0.5.23.2: Complete High-Impact Function Updates

## Parent Task
11.100.0.5.23 - Symbol Refactor - Function Parameters

## Priority
**MEDIUM** - Continue symbol refactor momentum after build fixes

## Overview
Complete the Symbol Refactor by updating remaining high-impact functions that still use raw string parameters for identifiers. This continues the work started in the parent task.

## Scope
Based on codebase analysis during the initial refactor, these core functions still need SymbolId overloads:

### Type Tracking Functions
- [ ] `track_assignment(tracker: FileTypeTracker, var_name: string, type_info: TypeInfo)` 
  - Location: `packages/core/src/type_analysis/type_tracking/type_tracking.ts`
  - Impact: HIGH - Used throughout type inference

### Symbol Resolution Functions  
- [ ] `find_symbol(symbol_name: string, scope: ScopeTree)` 
  - Locations: Multiple symbol resolution modules
  - Impact: HIGH - Core symbol lookup function

- [ ] `resolve_reference(name: string, context: ResolutionContext)`
  - Location: Symbol resolution modules
  - Impact: HIGH - Reference resolution

- [ ] `get_symbol_definition(name: string, analysis: FileAnalysis)`
  - Location: Symbol resolution modules  
  - Impact: HIGH - Definition lookup

### Method Resolution Functions
- [ ] `find_override(base_class: string, method: string, hierarchy: ClassHierarchy)`
  - Location: `packages/core/src/call_graph/method_calls/`
  - Impact: MEDIUM - Method override detection

- [ ] `check_implementation(interface_name: string, method: string, class_info: ClassNode)`
  - Location: Method resolution modules
  - Impact: MEDIUM - Interface implementation checking

## Implementation Strategy

### Phase 1: Type Tracking (Day 1)
Apply the proven overload pattern to `track_assignment()`:
```typescript
// New signature
function track_assignment(tracker: FileTypeTracker, variable_symbol: SymbolId, type_info: TypeInfo): FileTypeTracker;

// Legacy signature  
function track_assignment(tracker: FileTypeTracker, var_name: string, type_info: TypeInfo): FileTypeTracker;

// Implementation
function track_assignment(
  tracker: FileTypeTracker,
  varNameOrSymbol: string | SymbolId,
  type_info: TypeInfo
): FileTypeTracker {
  // Conversion logic...
}
```

### Phase 2: Symbol Resolution (Day 2)
Update the three symbol resolution functions using the same pattern:
- Focus on `find_symbol()` first (highest impact)
- Test thoroughly - these are critical path functions
- Add SymbolId imports where needed

### Phase 3: Method Resolution (Day 3)  
Update method resolution functions:
- `find_override()` and `check_implementation()`
- These may need dual SymbolId parameters (class + method)
- Follow the pattern established in `resolve_method_in_hierarchy()`

## Technical Approach

### Proven Overload Pattern
Use the same pattern established in parent task:
```typescript
function example_function(symbol: SymbolId, context: Context): Result;
function example_function(name: string, context: Context): Result;  
function example_function(symbolOrName: SymbolId | string, context: Context): Result {
  const name = typeof symbolOrName === 'string' && !symbolOrName.includes(':')
    ? symbolOrName
    : symbolOrName.split(':').pop() || '';
  // Implementation using extracted name...
}
```

### Import Strategy
- Add `import { SymbolId } from '@ariadnejs/types'` to each file
- Maintain minimal changes per file
- Document import additions for tracking

### Testing Strategy
- Existing tests continue to work (backward compatibility)
- Add basic smoke tests for new SymbolId signatures
- Focus on integration testing over unit testing

## Files to Update
Based on grep analysis from parent task:

### Primary Files
- `packages/core/src/type_analysis/type_tracking/type_tracking.ts`
- `packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.ts`
- `packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.python.ts`
- `packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.typescript.ts`
- `packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.javascript.ts`
- `packages/core/src/scope_analysis/symbol_resolution/symbol_resolution.rust.ts`

### Method Resolution Files
- `packages/core/src/call_graph/method_calls/method_hierarchy_resolver.ts` (additional functions)
- `packages/core/src/inheritance/method_override/method_override.*.ts`

## Dependencies
- **Requires**: Task 11.100.0.5.23.1 (build fixes) must be completed first
- **Builds on**: Parent task 11.100.0.5.23 implementation patterns

## Success Criteria
- ✅ All identified functions have SymbolId overloads
- ✅ Backward compatibility maintained (no breaking changes)
- ✅ New functions follow established pattern exactly
- ✅ All affected files compile successfully
- ✅ Basic integration testing passes

## Risk Assessment
- **Low Risk**: Using proven pattern from parent task
- **Medium Risk**: Symbol resolution functions are critical path
- **Mitigation**: Thorough testing, gradual rollout

## Estimated Time
**2-3 days** (as estimated in parent task)
- Day 1: Type tracking functions
- Day 2: Symbol resolution functions  
- Day 3: Method resolution functions + testing

## Notes
- This task directly continues the successful approach from the parent task
- Focus on consistency with established patterns
- After completion, ~80% of high-impact string→SymbolId migration will be done
- Sets up for Sub-Task 23.3 (interface updates)