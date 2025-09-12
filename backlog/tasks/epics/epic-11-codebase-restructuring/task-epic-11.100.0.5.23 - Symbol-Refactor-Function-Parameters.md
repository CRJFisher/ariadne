# Task 11.100.0.5.23: Symbol Refactor - Function Parameters

## Parent Task
11.100.0.5 - Review and Refine Types for Tree-sitter Query System

## Overview
Update function signatures that use raw strings for identifiers to use appropriate symbol types. This is a massive undertaking with hundreds of functions affected.

## Priority
**MEDIUM-HIGH** - Important for type safety but can be incremental

## Scope

### Previously Identified
- packages/types/src/import_export.ts - Symbol resolution functions
- packages/types/src/branded-types.ts - Builder functions

### Additionally Found - Raw String Parameters
**CRITICAL FINDING**: Hundreds of functions use `string` for identifier parameters

#### Common Patterns Found:
```typescript
// Current (BAD)
function resolve_method(class_name: string, method_name: string): any
function find_symbol(symbol_name: string): any
function track_variable(var_name: string): any

// Should be (GOOD)
function resolve_method(class_symbol: SymbolId, method_symbol: SymbolId): any
function find_symbol(symbol: SymbolId): any  
function track_variable(variable: SymbolId): any
```

## High-Impact Functions to Update

### Type Tracking Functions
- [ ] set_variable_type(var_name: string) → (symbol: SymbolId)
- [ ] get_variable_type(var_name: string) → (symbol: SymbolId)
- [ ] track_assignment(var_name: string) → (symbol: SymbolId)

### Symbol Resolution Functions
- [ ] find_symbol(symbol_name: string) → (symbol: SymbolId)
- [ ] resolve_reference(name: string) → (symbol: SymbolId)
- [ ] get_symbol_definition(name: string) → (symbol: SymbolId)

### Method Resolution Functions
- [ ] resolve_method(class_name: string, method_name: string)
- [ ] find_override(base_class: string, method: string)
- [ ] check_implementation(interface_name: string, method: string)

### Import/Export Functions
- [ ] imports_symbol(imp: Import, symbol: string) → SymbolId
- [ ] exports_symbol(exp: Export, symbol: string) → SymbolId
- [ ] resolve_import(module: string, symbol: string)

### Legacy Interfaces to Update
```typescript
// In type_tracking.ts
interface LegacyTypeInfo {
  variable_name?: string;  // → SymbolId
  type_name: string;       // → SymbolId
}

interface ImportedClassInfo {
  class_name: string;      // → SymbolId
  local_name: string;      // → SymbolId
}
```

## Implementation Strategy

### Phase 1: Core Functions (Week 1)
- Update type tracking functions
- Update symbol resolution functions
- Add overloads for compatibility

### Phase 2: Module Functions (Week 2)
- Update method resolution
- Update import/export functions
- Update call graph functions

### Phase 3: Helper Functions (Week 3)
- Update utility functions
- Update test helpers
- Remove deprecated overloads

## Overload Pattern
```typescript
// Support both during migration
function find_symbol(name: string): Symbol | undefined;
function find_symbol(id: SymbolId): Symbol | undefined;
function find_symbol(nameOrId: string | SymbolId): Symbol | undefined {
  const symbolId = typeof nameOrId === 'string' && !nameOrId.includes(':')
    ? adapt_to_symbol(nameOrId, 'unknown', getCurrentFile())
    : nameOrId as SymbolId;
  // Implementation
}
```

## Success Criteria
- All identifier parameters properly typed
- No raw strings for symbol lookup
- Overloads for migration period
- Performance impact minimal

## Dependencies
- Requires: Task 21 (Core Maps)
- Requires: Task 22 (Interfaces)
- Enhances: All modules

## Estimated Time
5-7 days (due to scope)

## Notes
- This is the largest refactor task
- Can be done incrementally
- Consider automation tools
- Track performance impact