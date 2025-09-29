# Task: Update JavaScript Tests

## Status: Created

## Parent Task

task-epic-11.102.5.1 - Update JavaScript

## Objective

Fix JavaScript language config tests to work with the new builder system and ensure comprehensive coverage of all fields being processed.

## Test Files to Update

- `packages/core/src/parse_and_query_code/language_configs/javascript.test.ts`
- `packages/core/tests/javascript/definitions.test.ts`
- `packages/core/tests/javascript/references.test.ts`
- `packages/core/tests/javascript/scopes.test.ts`

## Test Structure

### Language Config Tests

```typescript
// packages/core/src/parse_and_query_code/language_configs/javascript.test.ts

describe('JavaScript Language Config', () => {
  let context: ProcessingContext;
  let builder: DefinitionBuilder;

  beforeEach(() => {
    const scopes = new Map<ScopeId, LexicalScope>();
    // Add test scopes
    context = create_processing_context(scopes);
    builder = new DefinitionBuilder(context);
  });

  describe('Class Definitions', () => {
    it('should create class definition with all fields', () => {
      const capture: RawCapture = {
        category: SemanticCategory.DEFINITION,
        symbol_name: 'MyClass' as SymbolName,
        node_location: { start: { row: 1, column: 0 }, end: { row: 10, column: 1 }},
        node: parse_javascript('class MyClass extends BaseClass {}').rootNode,
        capture_name: 'def.class'
      };

      JAVASCRIPT_BUILDER_CONFIG.get('def.class')!.process(capture, builder, context);
      const definitions = builder.build();

      expect(definitions).toHaveLength(1);
      const classDef = definitions[0] as ClassDefinition;

      // Comprehensive field testing
      expect(classDef.kind).toBe('class');
      expect(classDef.name).toBe('MyClass');
      expect(classDef.symbol_id).toBeDefined();
      expect(classDef.scope_id).toBeDefined();
      expect(classDef.location).toEqual(capture.node_location);
      expect(classDef.availability.scope).toBeDefined();
      expect(classDef.extends).toEqual(['BaseClass']);
      expect(classDef.methods).toEqual([]);
      expect(classDef.properties).toEqual([]);
      expect(classDef.decorators).toEqual([]);
    });

    it('should handle class without extends', () => {
      // Test class with no base class
    });

    it('should handle class expressions', () => {
      // Test class expressions
    });
  });

  describe('Method Definitions', () => {
    it('should add method to existing class', () => {
      // Create class first
      const classCapture: RawCapture = { /* ... */ };
      JAVASCRIPT_BUILDER_CONFIG.get('def.class')!.process(classCapture, builder, context);

      // Add method
      const methodCapture: RawCapture = {
        category: SemanticCategory.DEFINITION,
        symbol_name: 'myMethod' as SymbolName,
        node_location: { /* ... */ },
        node: parse_javascript('class MyClass { myMethod() {} }')
          .rootNode.descendantForPosition({ row: 0, column: 16 }),
        capture_name: 'def.method'
      };

      JAVASCRIPT_BUILDER_CONFIG.get('def.method')!.process(methodCapture, builder, context);
      const definitions = builder.build();

      const classDef = definitions[0] as ClassDefinition;
      expect(classDef.methods).toHaveLength(1);
      expect(classDef.methods[0].name).toBe('myMethod');
      expect(classDef.methods[0].parameters).toEqual([]);
    });

    it('should handle async methods', () => {
      // Test async methods
    });

    it('should handle static methods', () => {
      // Test static methods
    });

    it('should handle private methods', () => {
      // Test private methods (#methodName)
    });
  });

  describe('Function Definitions', () => {
    it('should create function definition with signature', () => {
      const capture: RawCapture = {
        category: SemanticCategory.DEFINITION,
        symbol_name: 'myFunction' as SymbolName,
        node_location: { /* ... */ },
        node: parse_javascript('function myFunction(a, b = 5) {}').rootNode,
        capture_name: 'def.function'
      };

      JAVASCRIPT_BUILDER_CONFIG.get('def.function')!.process(capture, builder, context);
      const definitions = builder.build();

      const funcDef = definitions[0] as FunctionDefinition;
      expect(funcDef.kind).toBe('function');
      expect(funcDef.name).toBe('myFunction');
      expect(funcDef.signature).toBeDefined();
      expect(funcDef.signature.parameters).toHaveLength(0); // Parameters added separately
    });

    it('should handle arrow functions', () => {
      // Test arrow functions
    });

    it('should handle function expressions', () => {
      // Test function expressions
    });

    it('should handle async functions', () => {
      // Test async functions
    });
  });

  describe('Parameter Definitions', () => {
    it('should add parameters to functions', () => {
      // Create function first, then add parameters
    });

    it('should handle default parameters', () => {
      // Test parameters with default values
    });

    it('should handle rest parameters', () => {
      // Test ...rest parameters
    });

    it('should handle destructured parameters', () => {
      // Test { a, b } and [x, y] parameters
    });
  });

  describe('Variable Definitions', () => {
    it('should distinguish const from let/var', () => {
      const constCapture: RawCapture = {
        category: SemanticCategory.DEFINITION,
        symbol_name: 'MY_CONST' as SymbolName,
        node_location: { /* ... */ },
        node: parse_javascript('const MY_CONST = 42;').rootNode.descendantForPosition({ row: 0, column: 6 }),
        capture_name: 'def.variable'
      };

      JAVASCRIPT_BUILDER_CONFIG.get('def.variable')!.process(constCapture, builder, context);
      const definitions = builder.build();

      const varDef = definitions[0] as VariableDefinition;
      expect(varDef.kind).toBe('constant');
      expect(varDef.initial_value).toBe('42');
    });

    it('should handle let variables', () => {
      // Test let variables
    });

    it('should handle var variables', () => {
      // Test var variables
    });

    it('should extract initial values', () => {
      // Test initial value extraction
    });
  });

  describe('Import Definitions', () => {
    it('should handle default imports', () => {
      const capture: RawCapture = {
        category: SemanticCategory.DEFINITION,
        symbol_name: 'React' as SymbolName,
        node_location: { /* ... */ },
        node: parse_javascript("import React from 'react';").rootNode,
        capture_name: 'def.import'
      };

      JAVASCRIPT_BUILDER_CONFIG.get('def.import')!.process(capture, builder, context);
      const definitions = builder.build();

      const importDef = definitions[0] as ImportDefinition;
      expect(importDef.name).toBe('React');
      expect(importDef.import_path).toBe('react');
      expect(importDef.is_default).toBe(true);
      expect(importDef.is_namespace).toBe(false);
    });

    it('should handle named imports', () => {
      // Test { Component } from 'react'
    });

    it('should handle aliased imports', () => {
      // Test { Component as Comp } from 'react'
    });

    it('should handle namespace imports', () => {
      // Test * as React from 'react'
    });
  });

  describe('Property Definitions', () => {
    it('should add properties to classes', () => {
      // Test class properties
    });

    it('should handle private properties', () => {
      // Test #privateField
    });

    it('should handle static properties', () => {
      // Test static fields
    });
  });
});
```

### Coverage Requirements

Each definition type must test:

1. **All required fields populated**
   - symbol_id
   - name
   - location
   - scope_id
   - availability
   - kind

2. **Type-specific fields**
   - Classes: extends, methods, properties, constructor
   - Functions: signature, parameters
   - Methods: parameters, return_type
   - Variables: initial_value, constant vs variable
   - Imports: import_path, is_default, is_namespace, original_name
   - Properties: type, initial_value

3. **Edge cases**
   - Missing optional fields (should be undefined or empty array)
   - Nested definitions
   - Anonymous definitions
   - Dynamic names
   - Computed properties

4. **Scope assignment**
   - Each definition gets correct scope_id
   - Nested scopes handled correctly

5. **Availability determination**
   - Exported symbols
   - Private symbols
   - Public symbols
   - File-scoped symbols

## Integration Tests

```typescript
describe('JavaScript Integration', () => {
  it('should process complete file correctly', () => {
    const code = `
      import React from 'react';

      export class MyComponent extends React.Component {
        #privateField = 42;

        constructor(props) {
          super(props);
        }

        render() {
          return null;
        }
      }

      export default function App() {
        return new MyComponent();
      }
    `;

    const result = process_javascript_file(code);

    // Verify complete structure
    expect(result.scopes).toHaveLength(5); // module, class, constructor, render, App
    expect(result.definitions).toHaveLength(8); // import, class, property, constructor, param, method, function
    expect(result.references).toHaveLength(3); // React.Component, super, MyComponent
  });
});
```

## Success Criteria

- [ ] All definition types have test coverage
- [ ] All fields tested for each definition type
- [ ] Edge cases covered
- [ ] Integration tests passing
- [ ] No references to NormalizedCapture in tests
- [ ] Test helpers updated for new structure
- [ ] 100% code coverage maintained

## Estimated Effort

~1 hour