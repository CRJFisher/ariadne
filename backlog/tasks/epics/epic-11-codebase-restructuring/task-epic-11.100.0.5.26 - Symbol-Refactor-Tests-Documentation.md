# Task 11.100.0.5.26: Symbol Refactor - Tests and Documentation

## Parent Task
11.100.0.5 - Review and Refine Types for Tree-sitter Query System

## Overview
Update all test files to use symbol builders and update documentation with SymbolId patterns. This ensures consistency across the entire codebase.

## Priority
**LOW** - Can be done after main implementation

## Scope

### Test Files to Update
- All test files using hardcoded identifier strings
- Mock data using individual name types
- Test utilities creating identifiers

### Documentation to Update
- API documentation
- Migration guides
- Code examples
- Type documentation

## Implementation Checklist

### Test File Updates
- [ ] Replace hardcoded strings with symbol builders
- [ ] Update mock data generators
- [ ] Fix test assertions for SymbolId
- [ ] Update test utilities

### Documentation Updates
- [ ] API reference for symbol_utils
- [ ] Migration guide from name types to SymbolId
- [ ] Best practices document
- [ ] Performance considerations

## Test Update Patterns

### Before
```typescript
describe('function resolution', () => {
  it('resolves function by name', () => {
    const func_name = 'processData';
    const result = resolve_function(func_name);
    expect(result.name).toBe(func_name);
  });
});
```

### After
```typescript
describe('function resolution', () => {
  it('resolves function by symbol', () => {
    const func_symbol = function_symbol(
      'processData',
      'src/utils.ts',
      { file_path: 'src/utils.ts', line: 10, column: 0 }
    );
    const result = resolve_function(func_symbol);
    expect(symbol_from_string(result.symbol).name).toBe('processData');
  });
});
```

## Mock Data Patterns

### Before
```typescript
const mockFunction: FunctionDefinition = {
  name: 'testFunc' as FunctionName,
  // ...
};
```

### After
```typescript
const mockFunction: FunctionDefinition = {
  symbol: function_symbol('testFunc', 'test.ts'),
  // ...
};
```

## Documentation Sections

### Migration Guide
```markdown
# Migrating from Name Types to SymbolId

## Overview
The codebase has migrated from individual name types (VariableName, 
FunctionName, etc.) to a universal SymbolId system.

## Key Changes
- All Maps now use SymbolId as keys
- Function parameters accept SymbolId
- Arrays store SymbolId instead of names

## Migration Steps
1. Import symbol utilities
2. Replace name creation with symbol builders
3. Update lookups to use SymbolId
4. Extract names for display using symbol_from_string()

## Examples
[Include concrete examples]
```

### API Documentation
```typescript
/**
 * Creates a function symbol
 * @param name - The function name
 * @param scope - The file path where defined
 * @param location - Optional source location
 * @returns A SymbolId for the function
 * @example
 * const funcId = function_symbol('processData', 'src/utils.ts');
 */
```

## Test Categories

### Unit Tests
- [ ] Symbol utility tests
- [ ] Conversion function tests
- [ ] Builder function tests
- [ ] Parser function tests

### Integration Tests
- [ ] Symbol resolution tests
- [ ] Cross-file symbol tracking
- [ ] Import/export with symbols
- [ ] Type tracking with symbols

### Performance Tests
- [ ] Symbol creation performance
- [ ] Map lookup performance
- [ ] Memory usage tests
- [ ] String comparison benchmarks

## Success Criteria
- All tests use symbol builders
- No hardcoded identifier strings
- Documentation is comprehensive
- Migration guide is clear

## Dependencies
- Requires: Tasks 21-25 (Implementation)
- Final task in sequence

## Estimated Time
2-3 days

## Notes
- Can be done incrementally
- Good opportunity to improve test coverage
- Document performance implications