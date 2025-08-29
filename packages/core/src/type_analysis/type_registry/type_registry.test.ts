/**
 * Tests for Type Registry Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  create_type_registry,
  register_type,
  register_class,
  register_interface,
  lookup_type,
  get_file_types,
  get_module_exports,
  clear_file_types,
  register_alias,
  resolve_import,
  build_type_registry,
  TypeRegistry
} from './index';
import {
  ClassDefinition,
  InterfaceDefinition,
  TypeDefinition,
  ImportInfo,
  ExportInfo,
  FilePath,
  TypeName,
  QualifiedName
} from '@ariadnejs/types';

describe('Type Registry', () => {
  let registry: TypeRegistry;
  
  beforeEach(() => {
    registry = create_type_registry();
  });
  
  describe('create_type_registry', () => {
    it('should create an empty registry with builtins initialized', () => {
      expect(registry.types.size).toBe(0);
      expect(registry.files.size).toBe(0);
      expect(registry.exports.size).toBe(0);
      expect(registry.aliases.size).toBe(0);
      expect(registry.builtins.size).toBe(4); // 4 languages
      expect(registry.builtins.get('javascript')?.has('string' as TypeName)).toBe(true);
    });
  });
  
  describe('register_class', () => {
    it('should register a class definition', () => {
      const class_def: ClassDefinition = {
        name: 'MyClass',
        location: { start: 0, end: 100 },
        file_path: '/src/test.ts',
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, class_def, true, 'MyClass');
      
      const qualified_name = '/src/test.ts#MyClass' as QualifiedName;
      expect(registry.types.has(qualified_name)).toBe(true);
      expect(registry.files.get('/src/test.ts' as FilePath)?.has(qualified_name)).toBe(true);
      expect(registry.exports.get('/src/test.ts' as FilePath)?.get('MyClass')).toBe(qualified_name);
    });
    
    it('should handle class with inheritance', () => {
      const class_def: ClassDefinition = {
        name: 'ChildClass',
        location: { start: 0, end: 100 },
        file_path: '/src/child.ts',
        extends: ['ParentClass'],
        implements: ['IInterface'],
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, class_def);
      
      const type_def = registry.types.get('/src/child.ts#ChildClass' as QualifiedName);
      expect(type_def?.extends).toEqual(['ParentClass']);
      expect(type_def?.implements).toEqual(['IInterface']);
    });
  });
  
  describe('register_interface', () => {
    it('should register an interface definition', () => {
      const interface_def: InterfaceDefinition = {
        name: 'IMyInterface',
        location: { start: 0, end: 50 },
        file_path: '/src/types.ts',
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_interface(registry, interface_def, true);
      
      const qualified_name = '/src/types.ts#IMyInterface' as QualifiedName;
      expect(registry.types.has(qualified_name)).toBe(true);
      expect(registry.types.get(qualified_name)?.kind).toBe('interface');
    });
  });
  
  describe('lookup_type', () => {
    beforeEach(() => {
      const type_def: TypeDefinition = {
        name: 'TestType' as TypeName,
        file_path: '/src/test.ts' as FilePath,
        location: { start: 0, end: 50 },
        kind: 'class'
      };
      register_type(registry, type_def);
    });
    
    it('should find type by qualified name', () => {
      const found = lookup_type(
        registry,
        '/src/test.ts#TestType' as TypeName,
        'typescript',
        '/src/other.ts' as FilePath
      );
      expect(found?.name).toBe('TestType');
    });
    
    it('should find type with file context', () => {
      const found = lookup_type(
        registry,
        'TestType' as TypeName,
        'typescript',
        '/src/test.ts' as FilePath
      );
      expect(found?.name).toBe('TestType');
    });
    
    it('should find built-in types', () => {
      const found = lookup_type(
        registry,
        'string' as TypeName,
        'typescript'
      );
      expect(found).toBeDefined();
      expect(found?.file_path).toBe('<builtin>');
    });
    
    it('should return undefined for non-existent type', () => {
      const found = lookup_type(
        registry,
        'NonExistent' as TypeName,
        'typescript'
      );
      expect(found).toBeUndefined();
    });
  });
  
  describe('register_alias', () => {
    it('should register and resolve type aliases', () => {
      const type_def: TypeDefinition = {
        name: 'OriginalType' as TypeName,
        file_path: '/src/original.ts' as FilePath,
        location: { start: 0, end: 50 },
        kind: 'class'
      };
      register_type(registry, type_def);
      
      register_alias(
        registry,
        'AliasType' as TypeName,
        '/src/original.ts#OriginalType' as QualifiedName
      );
      
      const found = lookup_type(
        registry,
        'AliasType' as TypeName,
        'typescript'
      );
      expect(found?.name).toBe('OriginalType');
    });
  });
  
  describe('get_file_types', () => {
    it('should return all types in a file', () => {
      const file_path = '/src/multi.ts' as FilePath;
      
      const class1: ClassDefinition = {
        name: 'Class1',
        location: { start: 0, end: 50 },
        file_path,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      const class2: ClassDefinition = {
        name: 'Class2',
        location: { start: 60, end: 110 },
        file_path,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, class1);
      register_class(registry, class2);
      
      const types = get_file_types(registry, file_path);
      expect(types).toHaveLength(2);
      expect(types.map(t => t.name)).toContain('Class1');
      expect(types.map(t => t.name)).toContain('Class2');
    });
  });
  
  describe('get_module_exports', () => {
    it('should return exported types from a module', () => {
      const file_path = '/src/module.ts' as FilePath;
      
      const exported_class: ClassDefinition = {
        name: 'ExportedClass',
        location: { start: 0, end: 50 },
        file_path,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      const private_class: ClassDefinition = {
        name: 'PrivateClass',
        location: { start: 60, end: 110 },
        file_path,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, exported_class, true);
      register_class(registry, private_class, false);
      
      const exports = get_module_exports(registry, file_path);
      expect(exports.size).toBe(1);
      expect(exports.has('ExportedClass')).toBe(true);
      expect(exports.has('PrivateClass')).toBe(false);
    });
  });
  
  describe('clear_file_types', () => {
    it('should remove all types from a file', () => {
      const file_path = '/src/temp.ts' as FilePath;
      
      const class_def: ClassDefinition = {
        name: 'TempClass',
        location: { start: 0, end: 50 },
        file_path,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, class_def, true);
      expect(get_file_types(registry, file_path)).toHaveLength(1);
      
      clear_file_types(registry, file_path);
      expect(get_file_types(registry, file_path)).toHaveLength(0);
      expect(registry.exports.has(file_path)).toBe(false);
    });
  });
  
  describe('resolve_import', () => {
    it('should resolve imported types', () => {
      const source_file = '/src/source.ts' as FilePath;
      const importing_file = '/src/importer.ts' as FilePath;
      
      const exported_class: ClassDefinition = {
        name: 'ExportedClass',
        location: { start: 0, end: 50 },
        file_path: source_file,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, exported_class, true);
      
      const import_info: ImportInfo = {
        name: 'ExportedClass',
        source: source_file,
        kind: 'named',
        location: { start: 0, end: 30 }
      };
      
      const resolved = resolve_import(registry, import_info, importing_file);
      expect(resolved?.name).toBe('ExportedClass');
      
      // Check that resolution is cached
      const cache_key = `${importing_file}#ExportedClass`;
      expect(registry.import_cache.has(cache_key)).toBe(true);
    });
    
    it('should handle aliased imports', () => {
      const source_file = '/src/source.ts' as FilePath;
      const importing_file = '/src/importer.ts' as FilePath;
      
      const exported_class: ClassDefinition = {
        name: 'OriginalName',
        location: { start: 0, end: 50 },
        file_path: source_file,
        language: 'typescript',
        methods: [],
        properties: []
      };
      
      register_class(registry, exported_class, true, 'OriginalName');
      
      const import_info: ImportInfo = {
        name: 'OriginalName',
        source: source_file,
        alias: 'AliasedName',
        kind: 'named',
        location: { start: 0, end: 40 }
      };
      
      const resolved = resolve_import(registry, import_info, importing_file);
      expect(resolved?.name).toBe('OriginalName');
      
      // Check cache uses alias
      const cache_key = `${importing_file}#AliasedName`;
      expect(registry.import_cache.has(cache_key)).toBe(true);
    });
  });
  
  describe('build_type_registry', () => {
    it('should build registry from file analyses', () => {
      const analyses = [
        {
          file_path: '/src/file1.ts' as FilePath,
          classes: [
            {
              name: 'Class1',
              location: { start: 0, end: 50 },
              file_path: '/src/file1.ts',
              language: 'typescript' as const,
              methods: [],
              properties: []
            }
          ],
          exports: [
            {
              name: 'Class1',
              kind: 'named' as const,
              location: { start: 60, end: 80 }
            }
          ]
        },
        {
          file_path: '/src/file2.ts' as FilePath,
          interfaces: [
            {
              name: 'Interface1',
              location: { start: 0, end: 40 },
              file_path: '/src/file2.ts',
              language: 'typescript' as const,
              methods: [],
              properties: []
            }
          ]
        }
      ];
      
      const built_registry = build_type_registry(analyses);
      
      expect(built_registry.types.size).toBe(2);
      expect(built_registry.types.has('/src/file1.ts#Class1' as QualifiedName)).toBe(true);
      expect(built_registry.types.has('/src/file2.ts#Interface1' as QualifiedName)).toBe(true);
      expect(built_registry.exports.get('/src/file1.ts' as FilePath)?.has('Class1')).toBe(true);
      expect(built_registry.exports.has('/src/file2.ts' as FilePath)).toBe(false);
    });
  });
});