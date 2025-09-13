# SymbolId Migration Guide

## Overview

The codebase has transitioned from using individual name types (VariableName, FunctionName, ClassName, etc.) to a universal SymbolId system. This guide helps developers migrate existing code to use the new symbol system.

## Why SymbolId?

The SymbolId system provides several benefits:

1. **Eliminates ambiguity**: A name like "getValue" could be a function, method, or property - SymbolId encodes the kind
2. **Provides context**: Includes file scope and qualification information
3. **Type safety**: Branded types prevent mixing different identifier types
4. **Consistency**: One type for all identifiers instead of 15+ different types
5. **Performance**: Optimized string comparisons and map lookups

## Key Concepts

### SymbolId Format

SymbolIds are encoded strings with the format:
```
"kind:file_path:line:column:end_line:end_column:name[:qualifier]"
```

Examples:
- `"function:src/utils.ts:10:0:20:1:processData"`
- `"method:src/class.ts:15:2:18:3:getValue:MyClass"`
- `"variable:src/app.ts:5:6:5:11:myVar"`

### Symbol Structure

```typescript
interface Symbol {
  readonly kind: SymbolKind;
  readonly name: SymbolName;
  readonly qualifier?: SymbolName;  // For nested symbols
  readonly location: Location;
}
```

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { FunctionName, VariableName, ClassName } from '@ariadnejs/types';
```

**After:**
```typescript
import { 
  SymbolId,
  function_symbol,
  variable_symbol,
  class_symbol,
  method_symbol,
  symbol_from_string
} from '@ariadnejs/types';
```

### Step 2: Replace Type Declarations

**Before:**
```typescript
const functions = new Map<FunctionName, FunctionDefinition>();
const variables = new Map<VariableName, TypeInfo>();
const classes = new Map<ClassName, ClassDefinition>();
```

**After:**
```typescript
const functions = new Map<SymbolId, FunctionDefinition>();
const variables = new Map<SymbolId, TypeInfo>();
const classes = new Map<SymbolId, ClassDefinition>();
```

### Step 3: Update Symbol Creation

**Before:**
```typescript
const funcName: FunctionName = 'processData' as FunctionName;
const varName: VariableName = 'myVar' as VariableName;
const className: ClassName = 'MyClass' as ClassName;
```

**After:**
```typescript
const funcSymbol = function_symbol('processData', {
  file_path: 'src/utils.ts',
  line: 10,
  column: 0,
  end_line: 20,
  end_column: 1
});

const varSymbol = variable_symbol('myVar', {
  file_path: 'src/app.ts',
  line: 5,
  column: 6,
  end_line: 5,
  end_column: 11
});

const classSymbol = class_symbol('MyClass', 'src/classes.ts', {
  file_path: 'src/classes.ts',
  line: 8,
  column: 0,
  end_line: 50,
  end_column: 1
});
```

### Step 4: Update Function Signatures

**Before:**
```typescript
function find_function(name: FunctionName): FunctionDefinition | undefined {
  return functions.get(name);
}

function resolve_method(
  className: ClassName,
  methodName: MethodName
): MethodDefinition | undefined {
  // ...
}
```

**After:**
```typescript
function find_function(symbol: SymbolId): FunctionDefinition | undefined {
  return functions.get(symbol);
}

function resolve_method(
  classSymbol: SymbolId,
  methodSymbol: SymbolId
): MethodDefinition | undefined {
  // ...
}
```

### Step 5: Extract Names for Display

When you need to display or work with just the name part:

```typescript
const symbol = function_symbol('processData', location);
const symbolData = symbol_from_string(symbol);
console.log(`Function name: ${symbolData.name}`);
```

## Common Patterns

### Creating Symbols in Tests

```typescript
// Test setup
const funcSymbol = function_symbol('testFunc', {
  file_path: 'test.ts',
  line: 1,
  column: 0,
  end_line: 5,
  end_column: 1
});

const mockDef: Def = {
  id: 1,
  kind: 'definition',
  name: symbol_from_string(funcSymbol).name,
  symbol_kind: 'function',
  symbol_id: funcSymbol,
  range: { start: { row: 1, column: 0 }, end: { row: 5, column: 1 } },
  file_path: 'test.ts'
};
```

### Working with Method Symbols

```typescript
// Creating a method symbol
const methodSymbol = method_symbol('getValue', 'MyClass', {
  file_path: 'src/class.ts',
  line: 15,
  column: 2,
  end_line: 18,
  end_column: 3
});

// Extracting class and method names
const symbolData = symbol_from_string(methodSymbol);
const methodName = symbolData.name;
const className = symbolData.qualifier;
```

### Batch Operations

```typescript
// Converting multiple symbols
const symbols = [
  function_symbol('func1', location1),
  function_symbol('func2', location2),
  variable_symbol('var1', location3)
];

// Processing symbols
symbols.forEach(symbol => {
  const data = symbol_from_string(symbol);
  console.log(`${data.kind}: ${data.name}`);
});
```

## Performance Considerations

1. **Symbol Creation**: Create symbols once and reuse them rather than recreating
2. **Map Lookups**: SymbolIds are optimized for use as Map keys
3. **String Comparisons**: Use SymbolId equality directly, don't parse unnecessarily

```typescript
// Good - direct comparison
if (symbol1 === symbol2) { /* ... */ }

// Avoid - unnecessary parsing
if (symbol_from_string(symbol1).name === symbol_from_string(symbol2).name) { /* ... */ }
```

## Troubleshooting

### Invalid SymbolId Format

If you encounter "Invalid SymbolId format" errors:
1. Ensure you're using the factory functions (function_symbol, class_symbol, etc.)
2. Check that Location objects have all required fields
3. Verify file paths are absolute, not relative

### Type Mismatches

When migrating, you may encounter type errors:
1. Replace all occurrences of individual name types with SymbolId
2. Update function parameters and return types
3. Use symbol_from_string() to extract names when needed

### Migration Checklist

- [ ] Update all imports to use symbol utilities
- [ ] Replace Map key types from name types to SymbolId
- [ ] Update function signatures to accept SymbolId
- [ ] Replace hardcoded strings with symbol builders
- [ ] Update test files to use symbol builders
- [ ] Verify all tests pass after migration

## Examples by Module

### Call Graph Module

```typescript
// Before
const calls = new Map<FunctionName, CallInfo[]>();
calls.set('processData' as FunctionName, [...]);

// After
const funcSymbol = function_symbol('processData', location);
const calls = new Map<SymbolId, CallInfo[]>();
calls.set(funcSymbol, [...]);
```

### Type Tracking Module

```typescript
// Before
function track_variable_type(name: VariableName, type: TypeInfo): void {
  variableTypes.set(name, type);
}

// After
function track_variable_type(symbol: SymbolId, type: TypeInfo): void {
  variableTypes.set(symbol, type);
}
```

### Import/Export Module

```typescript
// Before
const exports = new Map<ExportName, ExportInfo>();

// After
const exports = new Map<SymbolId, ExportInfo>();
```

## Best Practices

1. **Always use factory functions** - Don't manually construct SymbolId strings
2. **Include location information** - Provides better context and debugging
3. **Use appropriate symbol kinds** - Choose the right factory function for the identifier type
4. **Cache symbols** - Create once, reuse throughout the module
5. **Document symbol usage** - Add comments explaining complex symbol relationships

## Summary

The SymbolId system simplifies identifier management across the codebase. By following this guide, you can successfully migrate from individual name types to the universal SymbolId system, resulting in more maintainable and type-safe code.