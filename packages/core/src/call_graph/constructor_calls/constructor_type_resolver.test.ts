/**
 * Tests for constructor type resolver
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  enrich_constructor_calls_with_types,
  validate_constructor,
  batch_validate_constructors,
  get_constructable_types,
  ConstructorCallWithType
} from './constructor_type_resolver';
import { ConstructorCallInfo } from '@ariadnejs/types';
import { TypeRegistry, create_type_registry } from '../../type_analysis/type_registry';

describe('constructor_type_resolver', () => {
  let registry: TypeRegistry;

  beforeEach(() => {
    registry = create_type_registry();
    
    // Add some test types to the registry
    registry.types.set('MyClass', {
      name: 'MyClass',
      file_path: 'test.ts',
      location: { line: 1, column: 0 },
      kind: 'class',
      members: new Map([
        ['constructor', {
          name: 'constructor',
          kind: 'constructor',
          parameters: [
            { name: 'name', type: 'string', is_optional: false },
            { name: 'age', type: 'number', is_optional: true }
          ]
        }]
      ])
    });

    registry.types.set('ImportedClass', {
      name: 'ImportedClass',
      file_path: 'lib/classes.ts',
      location: { line: 10, column: 0 },
      kind: 'class',
      members: new Map([
        ['constructor', {
          name: 'constructor',
          kind: 'constructor',
          parameters: []
        }]
      ])
    });

    registry.types.set('MyStruct', {
      name: 'MyStruct',
      file_path: 'test.rs',
      location: { line: 5, column: 0 },
      kind: 'struct',
      members: new Map([
        ['new', {
          name: 'new',
          kind: 'constructor',
          parameters: [
            { name: 'value', type: 'i32', is_optional: false }
          ]
        }]
      ])
    });

    // Set up file associations
    registry.files.set('test.ts', new Set(['MyClass']));
    registry.files.set('lib/classes.ts', new Set(['ImportedClass']));
    registry.files.set('test.rs', new Set(['MyStruct']));

    // Set up exports
    registry.exports.set('lib/classes.ts', new Map([
      ['ImportedClass', 'ImportedClass']
    ]));

    // Add a type alias
    registry.aliases.set('ClassAlias', 'MyClass');
  });

  describe('enrich_constructor_calls_with_types', () => {
    it('should enrich valid constructor calls', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 20, column: 10 },
          arguments: [{ value: '"test"' }, { value: '25' }],
          file_path: 'test.ts'
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        registry
      );

      expect(enriched).toHaveLength(1);
      expect(enriched[0].is_valid).toBe(true);
      expect(enriched[0].resolved_type).toBe('MyClass');
      expect(enriched[0].expected_params).toHaveLength(2);
      expect(enriched[0].param_mismatch).toBe(false);
    });

    it('should detect parameter mismatches', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 20, column: 10 },
          arguments: [], // Missing required parameter
          file_path: 'test.ts'
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        registry
      );

      expect(enriched[0].is_valid).toBe(true);
      expect(enriched[0].param_mismatch).toBe(true);
    });

    it('should mark invalid constructors', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'NonExistentClass',
          location: { line: 20, column: 10 },
          arguments: [],
          file_path: 'test.ts'
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        registry
      );

      expect(enriched[0].is_valid).toBe(false);
      expect(enriched[0].resolved_type).toBeUndefined();
    });

    it('should handle missing registry gracefully', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 20, column: 10 },
          arguments: []
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        undefined
      );

      expect(enriched).toEqual(constructor_calls);
    });
  });

  describe('validate_constructor', () => {
    it('should validate built-in types', () => {
      const validation = validate_constructor(
        'Array',
        registry,
        'test.js'
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.resolved_type).toBe('Array');
    });

    it('should validate local types', () => {
      const validation = validate_constructor(
        'MyClass',
        registry,
        'test.ts'
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.resolved_type).toBe('MyClass');
      expect(validation?.expected_params).toHaveLength(2);
    });

    it('should validate imported types', () => {
      const imports = [
        {
          name: 'ImportedClass',
          source: 'lib/classes.ts'
        }
      ];

      const validation = validate_constructor(
        'ImportedClass',
        registry,
        'app.ts',
        imports
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.is_imported).toBe(true);
      expect(validation?.resolved_type).toBe('ImportedClass');
    });

    it('should validate aliased types', () => {
      const validation = validate_constructor(
        'ClassAlias',
        registry,
        'test.ts'
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.resolved_type).toBe('MyClass');
    });

    it('should handle imported aliases', () => {
      const imports = [
        {
          name: 'ImportedClass',
          source: 'lib/classes.ts',
          alias: 'MyImport'
        }
      ];

      const validation = validate_constructor(
        'MyImport',
        registry,
        'app.ts',
        imports
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.is_imported).toBe(true);
    });

    it('should validate struct types', () => {
      const validation = validate_constructor(
        'MyStruct',
        registry,
        'test.rs'
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.type_kind).toBe('struct');
      expect(validation?.expected_params).toHaveLength(1);
    });

    it('should return undefined for non-constructable types', () => {
      // Add an interface (not constructable)
      registry.types.set('MyInterface', {
        name: 'MyInterface',
        file_path: 'test.ts',
        location: { line: 1, column: 0 },
        kind: 'interface',
        members: new Map()
      });
      registry.files.get('test.ts')?.add('MyInterface');

      const validation = validate_constructor(
        'MyInterface',
        registry,
        'test.ts'
      );

      expect(validation).toBeUndefined();
    });
  });

  describe('batch_validate_constructors', () => {
    it('should validate multiple constructor calls', () => {
      const calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 10, column: 5 },
          arguments: [],
          file_path: 'test.ts'
        },
        {
          class_name: 'Array',
          location: { line: 20, column: 5 },
          arguments: [],
          file_path: 'test.js'
        },
        {
          class_name: 'NonExistent',
          location: { line: 30, column: 5 },
          arguments: [],
          file_path: 'test.ts'
        }
      ];

      const imports = new Map([
        ['test.ts', []],
        ['test.js', []]
      ]);

      const results = batch_validate_constructors(calls, registry, imports);

      expect(results.size).toBe(2); // Only valid constructors
      expect(results.get(calls[0])?.is_valid).toBe(true);
      expect(results.get(calls[1])?.is_valid).toBe(true);
      expect(results.get(calls[2])).toBeUndefined();
    });
  });

  describe('get_constructable_types', () => {
    it('should return all constructable types', () => {
      const types = get_constructable_types(registry);

      expect(types).toContain('MyClass');
      expect(types).toContain('MyStruct');
      expect(types).not.toContain('MyInterface');
    });

    it('should filter by language', () => {
      const tsTypes = get_constructable_types(registry, 'typescript');
      expect(tsTypes).toContain('MyClass');
      expect(tsTypes).toContain('Array'); // Built-in
      expect(tsTypes).not.toContain('MyStruct');

      const rustTypes = get_constructable_types(registry, 'rust');
      expect(rustTypes).toContain('MyStruct');
      expect(rustTypes).toContain('Vec'); // Built-in
      expect(rustTypes).not.toContain('MyClass');
    });
  });

  describe('parameter validation', () => {
    it('should detect too few arguments', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 20, column: 10 },
          arguments: [], // Missing required 'name' parameter
          file_path: 'test.ts'
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        registry
      );

      expect(enriched[0].param_mismatch).toBe(true);
    });

    it('should allow optional parameters', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 20, column: 10 },
          arguments: [{ value: '"test"' }], // Only required param
          file_path: 'test.ts'
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        registry
      );

      expect(enriched[0].param_mismatch).toBe(false);
    });

    it('should detect too many arguments', () => {
      const constructor_calls: ConstructorCallInfo[] = [
        {
          class_name: 'MyClass',
          location: { line: 20, column: 10 },
          arguments: [
            { value: '"test"' },
            { value: '25' },
            { value: 'extra' } // Too many
          ],
          file_path: 'test.ts'
        }
      ];

      const enriched = enrich_constructor_calls_with_types(
        constructor_calls,
        registry
      );

      expect(enriched[0].param_mismatch).toBe(true);
    });
  });
});