# Task 11.100.0.5.22: Symbol Refactor - Interface Properties

## Parent Task
11.100.0.5 - Review and Refine Types for Tree-sitter Query System

## Overview
Update interface properties to use SymbolId, including both explicitly typed fields and generic string fields that represent identifiers.

## Priority
**HIGH** - Critical for API consistency

## Scope

### Previously Identified
- packages/types/src/definitions.ts - Name properties
- packages/types/src/calls.ts - Caller/callee properties
- packages/types/src/codegraph.ts - Variable names

### Additionally Found - Generic Name Fields
These use `name: string` but should be typed based on context:
- packages/types/src/definitions.ts Lines 36, 92, 112, 134, 150, 172, 183, 202, 231, 252
- packages/types/src/scopes.ts Line 55
- packages/types/src/symbol_scope.ts Line 70
- packages/types/src/type_analysis.ts Line 51
- packages/types/src/common.ts Line 51
- packages/types/src/modules.ts Lines 20, 22, 26, 38, 41, 95, 107, 124

## Implementation Checklist

### Call Interfaces
- [ ] calls.ts Line 43: `import_alias?: SymbolName`
- [ ] calls.ts Line 44: `original_name?: SymbolName`
- [ ] calls.ts Line 57: `callee: CalleeName`
- [ ] calls.ts Line 68: `method_name: CalleeName`
- [ ] calls.ts Line 69: `receiver: ReceiverName`

### Definition Interfaces
- [ ] definitions.ts Line 51: `parameter_names?: readonly ParameterName[]`
- [ ] definitions.ts Line 57: `name: FunctionName`
- [ ] All generic `name: string` fields - analyze context and type appropriately

### Module Interfaces
- [ ] modules.ts - Review all name fields for proper typing
- [ ] Convert module/package names to appropriate symbol types

### Scope Interfaces
- [ ] scopes.ts Line 55: Determine appropriate symbol type
- [ ] symbol_scope.ts Line 70: Type based on symbol kind

## Migration Strategy

### Phase 1: Add SymbolId Alternative
```typescript
interface FunctionDefinition {
  readonly name: FunctionName;           // Keep for compatibility
  readonly symbol_id?: SymbolId;         // New field
}
```

### Phase 2: Deprecate Old Fields
```typescript
interface FunctionDefinition {
  readonly name?: FunctionName;          // @deprecated
  readonly symbol_id: SymbolId;          // Required
}
```

### Phase 3: Clean Migration
```typescript
interface FunctionDefinition {
  readonly symbol: SymbolId;             // Final form
}
```

## Success Criteria
- All identifier fields properly typed
- No generic strings for identifiers
- Backward compatibility maintained
- Clear migration path

## Dependencies
- Requires: Task 21 (Core Maps)
- Related: Task 23 (Function Parameters)

## Estimated Time
2-3 days