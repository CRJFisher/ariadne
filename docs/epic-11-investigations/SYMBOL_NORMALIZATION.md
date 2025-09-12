# Symbol Normalization Investigation

## Problem Statement

We currently have multiple string-based identifier types scattered throughout the codebase:
- `VariableName` (branded string)
- `SymbolId` (branded string) 
- `FunctionName` (branded string)
- `ClassName` (branded string)
- Raw strings in various contexts

This leads to constant type conversions, especially when building maps where keys and values use different branded string types. The recent issue in `file_analyzer.ts` where we had to convert `Map<SymbolId, TrackedType>` to `Map<VariableName, TypeInfo>` is a perfect example of this problem.

## Proposed Solution: Symbol-Centric Architecture

### Core Concept

Use `SymbolId` as the universal identifier type throughout the codebase, with conversion functions for human-readable representations.

```typescript
// Core symbol functions
export function symbol_string(symbol: Symbol): SymbolId {
  // Convert a Symbol to its string representation
  return `${symbol.kind}:${symbol.scope}:${symbol.name}` as SymbolId;
}

export function symbol_from_string(symbol_string: SymbolId): Symbol {
  // Parse a SymbolId back into a Symbol structure
  const parts = symbol_string.split(':');
  return {
    kind: parts[0] as SymbolKind,
    scope: parts[1],
    name: parts[2]
  };
}

// Helper functions for specific contexts
export function variable_symbol(name: string, scope: string): SymbolId {
  return symbol_string({ kind: 'variable', scope, name });
}

export function function_symbol(name: string, scope: string): SymbolId {
  return symbol_string({ kind: 'function', scope, name });
}
```

### Benefits

1. **Single Source of Truth**: All identifiers use the same `SymbolId` type
2. **No More Conversions**: Maps can consistently use `Map<SymbolId, T>`
3. **Rich Context**: SymbolId carries semantic information (kind, scope, name)
4. **Type Safety**: Branded string prevents mixing with raw strings
5. **Reversible**: Can extract human-readable names when needed for display

### Implementation Strategy

#### Phase 1: Create Symbol Infrastructure
```typescript
// packages/types/src/symbols.ts
export interface Symbol {
  readonly kind: SymbolKind;
  readonly scope: string;  // File path or module name
  readonly name: string;   // Local identifier
  readonly qualifier?: string; // For nested symbols (e.g., Class.method)
}

export type SymbolKind = 
  | 'variable'
  | 'function' 
  | 'class'
  | 'method'
  | 'property'
  | 'parameter'
  | 'type'
  | 'import'
  | 'export';

// Conversion utilities
export const SymbolUtils = {
  create: (kind: SymbolKind, scope: string, name: string): SymbolId => {
    return `${kind}:${scope}:${name}` as SymbolId;
  },
  
  parse: (id: SymbolId): Symbol => {
    const [kind, scope, ...nameParts] = id.split(':');
    return {
      kind: kind as SymbolKind,
      scope,
      name: nameParts.join(':') // Handle names with colons
    };
  },
  
  getDisplayName: (id: SymbolId): string => {
    const symbol = SymbolUtils.parse(id);
    return symbol.qualifier 
      ? `${symbol.qualifier}.${symbol.name}`
      : symbol.name;
  }
};
```

#### Phase 2: Update Type Definitions

Replace all map key types with SymbolId:

```typescript
// Before
export interface FileAnalysis {
  type_info: ReadonlyMap<VariableName, TypeInfo>;
}

// After  
export interface FileAnalysis {
  type_info: ReadonlyMap<SymbolId, TypeInfo>;
}

// Before
export interface SymbolIndex {
  definitions: Map<string, SymbolDefinition>;
}

// After
export interface SymbolIndex {
  definitions: Map<SymbolId, SymbolDefinition>;
}
```

#### Phase 3: Update AST Processing

Modify AST processors to generate SymbolIds directly:

```typescript
// In type_tracking.ts
export interface FileTypeTracker {
  variable_types: Map<SymbolId, TrackedType>; // Already correct!
}

// In symbol_resolution.ts
export function register_symbol(
  kind: SymbolKind,
  name: string,
  file_path: string
): SymbolId {
  return SymbolUtils.create(kind, file_path, name);
}
```

### Migration Path

1. **Add SymbolUtils** without breaking changes
2. **Create adapters** for existing code:
   ```typescript
   export function adaptVariableName(name: VariableName, scope: string): SymbolId {
     return SymbolUtils.create('variable', scope, name);
   }
   ```
3. **Gradually migrate** modules to use SymbolId
4. **Remove adapters** once migration is complete
5. **Deprecate old types** (VariableName, FunctionName, etc.)

### Challenges & Solutions

**Challenge 1**: Existing code expects specific branded types
**Solution**: Provide compatibility layer during migration

**Challenge 2**: Human-readable output needed for debugging/display
**Solution**: Use `SymbolUtils.getDisplayName()` for UI/logs

**Challenge 3**: Different contexts need different symbol formats
**Solution**: Extend Symbol interface with optional context-specific fields

### Example: Fixed file_analyzer.ts

With this approach, no conversion would be needed:

```typescript
function build_file_analysis(
  // ... parameters ...
  type_tracker: FileTypeTracker,
  // ... more parameters ...
): FileAnalysis {
  // No conversion needed! Both use SymbolId
  const public_type_info = type_tracker.variable_types;
  
  return {
    // ... other fields ...
    type_info: public_type_info, // Direct assignment!
  };
}
```

## Conclusion

Moving to a Symbol-centric architecture would:
- Eliminate most type conversion code
- Provide better type safety
- Make the codebase more maintainable
- Preserve all necessary context in identifiers
- Support the tree-sitter query transformation (symbols map naturally to query captures)

This is a foundational change that would significantly improve the codebase's type consistency and reduce friction when passing data between modules.