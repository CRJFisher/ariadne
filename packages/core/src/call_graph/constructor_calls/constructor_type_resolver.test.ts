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
import { ConstructorCallInfo, FileAnalysis, ClassDefinition } from '@ariadnejs/types';
import { TypeRegistry, build_type_registry } from '../../type_analysis/type_registry';

describe('constructor_type_resolver', () => {
  let registry: TypeRegistry;

  beforeEach(() => {
    // Create test FileAnalysis objects with proper type definitions
    const test_file_analysis: FileAnalysis = {
      file_path: 'test.ts',
      source_code: '',
      language: 'typescript',
      functions: [],
      classes: [
        {
          name: 'MyClass',
          location: { line: 1, column: 0 },
          methods: [
            {
              name: 'constructor',
              location: { line: 2, column: 2 },
              parameters: [
                { name: 'name', type: 'string', is_optional: false },
                { name: 'age', type: 'number', is_optional: true }
              ],
              returns: undefined,
              body: { start: 0, end: 0 },
              is_exported: false,
              is_async: false,
              decorators: [],
              visibility: 'public'
            }
          ],
          properties: [],
          decorators: [],
          extends: undefined,
          implements: [],
          is_exported: true
        }
      ],
      imports: [],
      exports: [],
      variables: [],
      errors: [],
      scopes: { type: 'global', start: 0, end: 0, children: [] },
      interfaces: [],
      enums: [],
      type_aliases: [
        {
          name: 'ClassAlias',
          location: { line: 50, column: 0 },
          type: 'MyClass',
          is_exported: false
        }
      ],
      structs: []
    };

    const lib_file_analysis: FileAnalysis = {
      file_path: 'lib/classes.ts',
      source_code: '',
      language: 'typescript',
      functions: [],
      classes: [
        {
          name: 'ImportedClass',
          location: { line: 10, column: 0 },
          methods: [
            {
              name: 'constructor',
              location: { line: 11, column: 2 },
              parameters: [],
              returns: undefined,
              body: { start: 0, end: 0 },
              is_exported: false,
              is_async: false,
              decorators: [],
              visibility: 'public'
            }
          ],
          properties: [],
          decorators: [],
          extends: undefined,
          implements: [],
          is_exported: true
        }
      ],
      imports: [],
      exports: [
        {
          symbol_name: 'ImportedClass',
          location: { line: 30, column: 0 },
          is_default: false,
          is_type_export: false,
          source: undefined,
          local_name: 'ImportedClass'
        }
      ],
      variables: [],
      errors: [],
      scopes: { type: 'global', start: 0, end: 0, children: [] },
      interfaces: [],
      enums: [],
      type_aliases: [],
      structs: []
    };

    const rust_file_analysis: FileAnalysis = {
      file_path: 'test.rs',
      source_code: '',
      language: 'rust',
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      variables: [],
      errors: [],
      scopes: { type: 'global', start: 0, end: 0, children: [] },
      interfaces: [],
      enums: [],
      type_aliases: [],
      structs: [
        {
          name: 'MyStruct',
          location: { line: 5, column: 0 },
          fields: [],
          methods: [
            {
              name: 'new',
              location: { line: 6, column: 2 },
              parameters: [
                { name: 'value', type: 'i32', is_optional: false }
              ],
              returns: 'Self',
              body: { start: 0, end: 0 },
              is_exported: false,
              is_async: false,
              decorators: [],
              visibility: 'public'
            }
          ],
          is_exported: false
        }
      ]
    };

    registry = build_type_registry([test_file_analysis, lib_file_analysis, rust_file_analysis]);
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
      expect(enriched[0].resolved_type).toBe('test.ts#MyClass');
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
      expect(validation?.resolved_type).toBe('test.ts#MyClass');
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
      expect(validation?.resolved_type).toBe('lib/classes.ts#ImportedClass');
    });

    it('should validate aliased types', () => {
      const validation = validate_constructor(
        'ClassAlias',
        registry,
        'test.ts'
      );

      expect(validation).toBeDefined();
      expect(validation?.is_valid).toBe(true);
      expect(validation?.resolved_type).toBe('test.ts#MyClass');
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
      expect(validation?.type_kind).toBe('class'); // Structs are treated as classes
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

      expect(types).toContain('test.ts#MyClass');
      expect(types).toContain('test.rs#MyStruct');
      expect(types).not.toContain('MyInterface');
    });

    it('should filter by language', () => {
      const ts_types = get_constructable_types(registry, 'typescript');
      expect(ts_types).toContain('test.ts#MyClass');
      expect(ts_types).toContain('Array'); // Built-in
      expect(ts_types).not.toContain('test.rs#MyStruct');

      const rust_types = get_constructable_types(registry, 'rust');
      expect(rust_types).toContain('test.rs#MyStruct');
      expect(rust_types).toContain('Vec'); // Built-in
      expect(rust_types).not.toContain('test.ts#MyClass');
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