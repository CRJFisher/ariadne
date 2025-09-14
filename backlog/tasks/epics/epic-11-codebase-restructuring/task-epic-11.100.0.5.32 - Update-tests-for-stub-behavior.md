# Task 11.100.0.5.32: Update Tests for Stub Behavior

## Status
Status: Not Started
Priority: Medium
Created: 2025-09-14
Epic: epic-11-codebase-restructuring

## Summary
Update all tests to work with the stubbed AST processing modules. Tests should expect empty results from extraction functions and focus on testing the enhancement/resolution layers with mock data.

## Test Update Strategy

### 1. Unit Tests for Stub Modules
Convert extraction tests to verify stub behavior:
```typescript
// Before: function_calls.test.ts
it('should extract function calls', () => {
  const result = find_function_calls(tree, source, 'javascript');
  expect(result).toHaveLength(3);
  expect(result[0].name).toBe('console.log');
});

// After: function_calls.test.ts
it('should return empty array (stub)', () => {
  const result = find_function_calls(tree, source, 'javascript');
  expect(result).toEqual([]);
  // TODO: Re-enable when query-based extraction is implemented
});
```

### 2. Integration Tests
Update to work with empty extraction results:
```typescript
// file_analyzer.test.ts
it('should return valid FileAnalysis with stub extractors', async () => {
  const analysis = await analyze_file(file);
  
  // Verify structure is valid
  expect(analysis).toHaveProperty('imports');
  expect(analysis).toHaveProperty('exports');
  expect(analysis).toHaveProperty('functions');
  
  // Expect empty results from stubs
  expect(analysis.imports).toEqual([]);
  expect(analysis.exports).toEqual([]);
  expect(analysis.functions).toEqual([]);
});
```

### 3. Enhancement Module Tests
Use mock data instead of extraction results:
```typescript
// method_hierarchy_resolver.test.ts
it('should resolve method hierarchy with mock data', () => {
  const mock_methods: MethodCall[] = [
    // Create mock method calls directly
  ];
  
  const result = resolve_method_hierarchy(mock_methods, class_hierarchy);
  // Test enhancement logic with controlled input
});
```

## Files to Update

### Primary Test Files
1. **AST Processing Module Tests**
   - `scope_tree/*.test.ts` - Expect empty results
   - `function_calls/*.test.ts` - Expect empty results
   - `method_calls/*.test.ts` - Expect empty results
   - `constructor_calls/*.test.ts` - Expect empty results
   - `class_detection/*.test.ts` - Expect empty results
   - `type_tracking/*.test.ts` - Expect empty results
   - `import_resolution/*.test.ts` - Expect empty results
   - `export_detection/*.test.ts` - Expect empty results

2. **Integration Tests**
   - `file_analyzer.test.ts` - Update expectations
   - `code_graph.test.ts` - Use mock data

3. **Enhancement Module Tests**
   - Keep existing tests but provide mock input data
   - Test business logic independently of extraction

## Test Organization

### Skip vs Delete
- **Skip**: Tests that will be re-enabled with query implementation
- **Delete**: Tests for deleted helper functions
- **Update**: Tests that can work with stubs or mock data

### Documentation Pattern
```typescript
describe('function_calls (stub)', () => {
  it.skip('FUTURE: should extract function calls with queries', () => {
    // Test disabled until query implementation
  });
  
  it('should return empty array', () => {
    // Current stub behavior
  });
});
```

## Success Criteria
- All tests pass with stub implementations
- No tests rely on deleted helper functions
- Enhancement module tests use mock data
- Clear documentation of temporary test state
- Test coverage remains meaningful

## Dependencies
- Task 27: Stub modules implemented
- Task 30: file_analyzer updated
- Task 31: Helper functions deleted

## Follow-up Tasks
- Task 33: Re-enable tests with query implementation
- Task 34: Add query-based extraction tests