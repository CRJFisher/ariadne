# Task 11.100.0.5.33: Survey and Enforce SymbolId Architecture

## Status
Status: Not Started
Priority: Critical
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary

Conduct a comprehensive survey of the reduced codebase to ensure the SymbolId-based architecture is applied universally. Fix any remaining instances of raw strings or old identifier patterns.

## Survey Areas

### 1. Symbol References
Ensure all symbol references use SymbolId:
```typescript
// ❌ BAD - Raw strings
const symbols = new Map<string, Symbol>();
function findFunction(name: string): Function;

// ✅ GOOD - SymbolId
const symbols = new Map<SymbolId, Symbol>();
function findFunction(symbol: SymbolId): Function;
```

### 2. Call Information
Verify all calls use unified types:
```typescript
// All calls should have:
interface CallInfo {
  symbol: SymbolId;  // Not string!
  location: Location;
  arguments: CallArgument[];
}
```

### 3. Definition Storage
Check all definition maps:
```typescript
// Every module should use:
Map<SymbolId, FunctionDefinition>
Map<SymbolId, ClassDefinition>
Map<SymbolId, MethodDefinition>
// Never Map<string, ...>
```

### 4. Cross-File Resolution
Verify enhancement modules use SymbolId:
- Symbol resolution
- Type propagation
- Method hierarchy resolution
- Namespace resolution

## Implementation Checklist

### Core Modules to Verify

1. **file_analyzer.ts**
   - [ ] Symbol maps use SymbolId keys
   - [ ] No raw string identifiers

2. **code_graph.ts**
   - [ ] All symbol operations use SymbolId
   - [ ] Resolution results keyed by SymbolId

3. **Enhancement Modules**
   - [ ] symbol_resolution uses SymbolId
   - [ ] type_propagation uses SymbolId
   - [ ] method_hierarchy_resolver uses SymbolId
   - [ ] namespace_resolution uses SymbolId

4. **Types Package**
   - [ ] No string-based identifier types remain
   - [ ] All branded types properly defined
   - [ ] Type guards use SymbolId

### Search Patterns

Use these patterns to find violations:
```bash
# Find raw string maps
grep -r "Map<string," packages/core/src

# Find string parameters in symbol functions
grep -r "name: string" packages/core/src

# Find old identifier patterns
grep -r "FunctionName\|ClassName\|MethodName" packages/core/src

# Find direct .name access (should be .symbol)
grep -r "\.name[^a-zA-Z]" packages/core/src
```

## Migration Patterns

### Common Fixes

1. **Map Keys**
   ```typescript
   // Before
   const funcs = new Map<string, Function>();
   // After  
   const funcs = new Map<SymbolId, Function>();
   ```

2. **Function Parameters**
   ```typescript
   // Before
   function resolve(name: string, className?: string)
   // After
   function resolve(symbol: SymbolId, classSymbol?: SymbolId)
   ```

3. **Property Access**
   ```typescript
   // Before
   if (call.name === 'foo')
   // After
   if (call.symbol === function_symbol('foo', file, location))
   ```

## Validation

### Type Checking
After changes, ensure:
- `npm run typecheck` passes
- No type errors related to identifiers
- Branded types prevent mixing

### Runtime Validation
Create validation utilities:
```typescript
function validateSymbolMap<T>(map: Map<any, T>): void {
  for (const key of map.keys()) {
    if (!isSymbolId(key)) {
      throw new Error(`Invalid key type: ${typeof key}`);
    }
  }
}
```

## Success Criteria

- Zero instances of `Map<string,` for symbol storage
- All identifier parameters use SymbolId
- No raw string comparisons for symbols
- Type system enforces SymbolId usage
- Enhancement modules fully migrated

## Expected Impact

- **Type Safety**: Branded types prevent identifier confusion
- **Consistency**: One pattern for all identifiers
- **Maintainability**: Clear symbol semantics
- **Future-Proof**: Ready for query-based extraction

## Dependencies

- Task 32: Old types deleted
- Tasks 27-31: Codebase simplified

## Follow-up Tasks

- Document SymbolId patterns for contributors
- Add linting rules to enforce SymbolId usage