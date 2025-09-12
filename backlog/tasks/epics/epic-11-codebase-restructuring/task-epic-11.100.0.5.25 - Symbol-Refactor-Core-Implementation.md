# Task 11.100.0.5.25: Symbol Refactor - Core Implementation

## Parent Task
11.100.0.5 - Review and Refine Types for Tree-sitter Query System

## Overview
Update core implementation files to use SymbolId consistently throughout internal data structures and algorithms.

## Priority
**MEDIUM** - Internal implementation can be updated incrementally

## Scope

### Core Modules to Update
- packages/core/src/inheritance/class_hierarchy/
- packages/core/src/scope_analysis/scope_tree/
- packages/core/src/type_analysis/type_tracking/
- packages/core/src/call_graph/*/

### Key Implementation Areas

#### Scope Tree Implementation
- Internal symbol tracking
- Scope-to-symbol mappings
- Symbol resolution logic
- Variable tracking

#### Class Hierarchy Implementation
- Class relationship tracking
- Method override detection
- Interface implementation checking
- Inheritance chain building

#### Type Tracking Implementation
- Variable type maps
- Type flow tracking
- Import class tracking
- Type inference logic

## Implementation Checklist

### Scope Tree Module
- [ ] scope_tree.ts: Symbol storage maps
- [ ] enhanced_symbols.ts: Enhanced symbol maps
- [ ] symbol_resolution.ts: Resolution logic
- [ ] usage_finder.ts: Usage tracking

### Class Hierarchy Module
- [ ] class_hierarchy.ts: Class maps and lookups
- [ ] method_override.ts: Override detection
- [ ] interface_implementation.ts: Implementation checking

### Type Tracking Module
- [ ] type_tracking.ts: Variable type maps
- [ ] type_propagation.ts: Type flow
- [ ] generic_resolution.ts: Generic handling

### Call Graph Modules
- [ ] function_calls.ts: Call tracking
- [ ] method_calls.ts: Method resolution
- [ ] constructor_calls.ts: Constructor tracking
- [ ] call_chain_analysis.ts: Chain building

## Conversion Patterns

### Map Updates
```typescript
// Before
const symbols = new Map<string, Symbol>();
symbols.set(name, symbol);

// After
const symbols = new Map<SymbolId, Symbol>();
symbols.set(symbol_id, symbol);
```

### Lookup Updates
```typescript
// Before
function find_symbol(name: string): Symbol | undefined {
  return this.symbols.get(name);
}

// After
function find_symbol(id: SymbolId): Symbol | undefined {
  return this.symbols.get(id);
}
```

### Collection Updates
```typescript
// Before
const visited = new Set<string>();
visited.add(className);

// After
const visited = new Set<SymbolId>();
visited.add(classSymbolId);
```

## Performance Considerations

### String Length Impact
- SymbolId strings are 3-4x longer
- Consider caching for hot paths
- Profile memory usage

### Optimization Strategies
```typescript
// Cache frequently used SymbolIds
class SymbolCache {
  private cache = new Map<string, SymbolId>();
  
  get(name: string, kind: SymbolKind, scope: FilePath): SymbolId {
    const key = `${kind}:${scope}:${name}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, symbol_string({
        kind, scope, name, location: DEFAULT_LOCATION
      }));
    }
    return this.cache.get(key)!;
  }
}
```

## Success Criteria
- All internal maps use SymbolId
- No performance regression
- Cleaner resolution logic
- Better type safety

## Dependencies
- Requires: Tasks 21-24 (Type updates)
- Enhances: All module functionality

## Estimated Time
3-4 days

## Notes
- Can be done module by module
- Consider performance profiling
- Update tests alongside implementation