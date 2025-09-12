# Task 11.100.0.5.24: Symbol Refactor - Array Properties

## Parent Task
11.100.0.5 - Review and Refine Types for Tree-sitter Query System

## Overview
Change array properties from individual name type arrays to SymbolId arrays for consistency and type safety.

## Priority
**MEDIUM** - Important for consistency

## Scope

### Class Hierarchy Arrays
- packages/types/src/classes.ts
  - Line 24: `readonly base_classes: readonly ClassName[]`
  - Line 25: `readonly derived_classes: readonly ClassName[]`
  - Line 26: `readonly interfaces?: readonly InterfaceName[]`

### Type Definition Arrays
- packages/types/src/types.ts
  - Line 30: `readonly type_parameters?: readonly TypeName[]`
  - Line 32: `readonly extends?: readonly TypeName[]`
  - Line 33: `readonly implements?: readonly InterfaceName[]`

### Function Definition Arrays
- packages/types/src/definitions.ts
  - Line 51: `readonly parameter_names?: readonly ParameterName[]`
  - Various decorator and modifier arrays

## Implementation Checklist

### Class Arrays
- [ ] base_classes: ClassName[] → SymbolId[]
- [ ] derived_classes: ClassName[] → SymbolId[]
- [ ] interfaces: InterfaceName[] → SymbolId[]
- [ ] mixins: TypeName[] → SymbolId[]

### Type Arrays
- [ ] type_parameters: TypeName[] → SymbolId[]
- [ ] extends: TypeName[] → SymbolId[]
- [ ] implements: InterfaceName[] → SymbolId[]
- [ ] constraints: TypeName[] → SymbolId[]

### Function Arrays
- [ ] parameter_names: ParameterName[] → SymbolId[]
- [ ] decorators: string[] → SymbolId[] (where applicable)
- [ ] generic_parameters: string[] → SymbolId[]

### Module Arrays
- [ ] exported_symbols: string[] → SymbolId[]
- [ ] imported_symbols: string[] → SymbolId[]
- [ ] re_exported: string[] → SymbolId[]

## Migration Example

### Before
```typescript
interface ClassDefinition {
  readonly base_classes: readonly ClassName[];
  readonly interfaces?: readonly InterfaceName[];
}
```

### After
```typescript
interface ClassDefinition {
  readonly base_classes: readonly SymbolId[];
  readonly interfaces?: readonly SymbolId[];
  // For display purposes, can extract names from SymbolId
}
```

## Helper Functions
```typescript
// Convert array of names to SymbolIds
function to_symbol_array(
  names: readonly string[],
  kind: SymbolKind,
  scope: FilePath
): SymbolId[] {
  return names.map(name => 
    symbol_string({
      kind,
      scope,
      name: name as SymbolName,
      location: { file_path: scope, line: 0, column: 0 }
    })
  );
}

// Extract names from SymbolId array for display
function extract_names(symbols: readonly SymbolId[]): string[] {
  return symbols.map(id => symbol_from_string(id).name);
}
```

## Success Criteria
- All identifier arrays use SymbolId
- Helper functions for conversion
- Display logic preserved
- No breaking changes

## Dependencies
- Requires: Task 21 (Core Maps)
- Requires: Task 22 (Interfaces)
- Related: Task 23 (Function Parameters)

## Estimated Time
2 days

## Notes
- Arrays are simpler than Maps to migrate
- Can provide utility functions for common operations
- Consider performance of array operations with longer strings