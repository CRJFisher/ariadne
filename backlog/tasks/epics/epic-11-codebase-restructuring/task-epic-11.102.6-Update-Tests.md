# Task: Update Tests for Direct Definition Creation

## Status: Created

## Parent Task
task-epic-11.102 - Replace NormalizedCapture with Direct Definition Builders

## Objective

Update all tests to work with the new direct Definition creation system, removing any tests related to NormalizedCapture.

## Test Files to Update

### Core Tests
- `packages/core/src/parse_and_query_code/definition_builder.test.ts` (NEW)
- `packages/core/src/parse_and_query_code/language_configs/*.test.ts`

### Integration Tests
- Any tests that use NormalizedCapture
- Symbol resolution tests that depend on capture format

## New Test Structure

### Builder Tests

```typescript
// packages/core/src/parse_and_query_code/definition_builder.test.ts

describe('DefinitionBuilder', () => {
  describe('functional composition', () => {
    it('should chain process calls', () => {
      const builder = new DefinitionBuilder()
        .process(classCapture)
        .process(methodCapture1)
        .process(methodCapture2);

      const definitions = builder.build();
      expect(definitions.classes[0].methods).toHaveLength(2);
    });
  });

  describe('non-null guarantees', () => {
    it('should always return non-null arrays', () => {
      const builder = new DefinitionBuilder();
      const definitions = builder.build();

      expect(definitions.classes).toEqual([]);
      expect(definitions.functions).toEqual([]);
      // Never undefined or null
    });
  });

  describe('natural ordering', () => {
    it('should handle out-of-order captures', () => {
      const builder = new DefinitionBuilder()
        .process(methodCapture)  // Method before class
        .process(classCapture);  // Class created retroactively

      const definitions = builder.build();
      expect(definitions.classes[0].methods).toContain(methodCapture);
    });
  });
});
```

### Language Config Tests

```typescript
describe('JavaScript Builder Config', () => {
  it('should create ClassDefinition from class capture', () => {
    const capture: RawCapture = {
      category: SemanticCategory.DEFINITION,
      symbol_name: 'MyClass' as SymbolName,
      node_location: { start: 0, end: 100 },
      node: mock_class_node,
      capture_name: 'def.class'
    };

    const builder = new DefinitionBuilder();
    JAVASCRIPT_BUILDER_CONFIG.get('def.class')!.process(capture, builder);

    const definitions = builder.build();
    expect(definitions.classes).toHaveLength(1);
    expect(definitions.classes[0].name).toBe('MyClass');
  });

  it('should assemble complete class with methods', () => {
    const builder = process_file(class_with_methods_captures);
    const class_def = builder.build().classes[0];

    expect(class_def.methods).toHaveLength(3);
    expect(class_def.methods[0].name).toBe('constructor');
    expect(class_def.methods[1].name).toBe('method1');
    expect(class_def.methods[2].name).toBe('method2');
  });
});
```

## Test Scenarios to Cover

### Basic Definition Creation
- [ ] Create function definition
- [ ] Create class definition
- [ ] Create variable definition
- [ ] Create import definition

### Complex Assembly
- [ ] Class with multiple methods
- [ ] Class with properties and methods
- [ ] Class with inheritance
- [ ] Function with parameters
- [ ] Method with decorators

### Edge Cases
- [ ] Empty class (no methods/properties)
- [ ] Method capture before class capture
- [ ] Parameter capture before function capture
- [ ] Duplicate captures (should update, not duplicate)

### Non-null Guarantees
- [ ] Empty arrays never null
- [ ] Optional fields properly typed
- [ ] Required fields always present

## Performance Tests

```typescript
describe('Builder Performance', () => {
  it('should handle large files efficiently', () => {
    const large_file = generate_captures(1000); // 1000 captures

    const start = Date.now();
    const builder = process_captures(large_file);
    const end = Date.now();

    expect(end - start).toBeLessThan(100); // < 100ms
  });
});
```

## Success Criteria

- [ ] All builder tests pass
- [ ] All language config tests updated
- [ ] No references to NormalizedCapture in tests
- [ ] 100% code coverage maintained
- [ ] Performance benchmarks met

## Dependencies

- All previous tasks (102.1 through 102.5) complete

## Estimated Effort

~2 hours