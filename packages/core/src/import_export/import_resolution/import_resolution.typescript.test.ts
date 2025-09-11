/**
 * Tests for TypeScript bespoke import resolution
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolve_type_only_import,
  resolve_declaration_file_import,
  resolve_type_namespace_import,
  resolve_module_augmentation,
  resolve_ambient_module,
  resolve_triple_slash_reference,
  is_type_only_import,
  resolve_index_declaration_exports
} from './import_resolution.typescript';
import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';

describe('import_resolution.typescript', () => {
  describe('resolve_type_only_import', () => {
    it('should resolve type-only imports for types', () => {
      const imp: ImportedSymbol = {
        name: 'MyInterface',
        is_type_only: true
      };
      
      const mockModule: ModuleNode = {
        path: '/project/types.ts',
        imports: new Map(),
        exports: new Map([
          ['MyInterface', {
            name: 'MyInterface',
            kind: 'interface',
            location: { line: 1, column: 1, file_path: '/project/types.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_only_import(imp, mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('MyInterface');
      expect(result?.kind).toBe('interface');
    });
    
    it('should resolve type-only imports for type aliases', () => {
      const imp: ImportedSymbol = {
        name: 'MyType',
        is_type_only: true
      };
      
      const mockModule: ModuleNode = {
        path: '/project/types.ts',
        imports: new Map(),
        exports: new Map([
          ['MyType', {
            name: 'MyType',
            kind: 'type_alias',
            location: { line: 1, column: 1, file_path: '/project/types.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_only_import(imp, mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('MyType');
      expect(result?.kind).toBe('type_alias');
    });
    
    it('should handle value imports used as types (for typeof)', () => {
      const imp: ImportedSymbol = {
        name: 'myFunction',
        is_type_only: true
      };
      
      const mockModule: ModuleNode = {
        path: '/project/utils.ts',
        imports: new Map(),
        exports: new Map([
          ['myFunction', {
            name: 'myFunction',
            kind: 'function',
            location: { line: 1, column: 1, file_path: '/project/utils.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_only_import(imp, mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('myFunction');
      expect(result?.is_type_only).toBe(true);
    });
    
    it('should return undefined for non-type imports', () => {
      const imp: ImportedSymbol = {
        name: 'MyType',
        is_type_only: false
      };
      
      const mockModule: ModuleNode = {
        path: '/project/types.ts',
        imports: new Map(),
        exports: new Map(),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_only_import(imp, mockModule);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_declaration_file_import', () => {
    it('should resolve imports from .d.ts files', () => {
      const imp: ImportedSymbol = {
        name: 'LibraryType'
      };
      
      const mockModule: ModuleNode = {
        path: '/project/library.d.ts',
        imports: new Map(),
        exports: new Map([
          ['LibraryType', {
            name: 'LibraryType',
            kind: 'type',
            location: { line: 1, column: 1, file_path: '/project/library.d.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(mockModule)
        }
      };
      
      const result = resolve_declaration_file_import('/project/library.d.ts', imp, context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('LibraryType');
      expect(result?.is_type_only).toBe(true);
    });
    
    it('should find corresponding .d.ts file for regular imports', () => {
      const imp: ImportedSymbol = {
        name: 'Config'
      };
      
      const mockModule: ModuleNode = {
        path: '/project/config.d.ts',
        imports: new Map(),
        exports: new Map([
          ['Config', {
            name: 'Config',
            kind: 'interface',
            location: { line: 1, column: 1, file_path: '/project/config.d.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockImplementation(path => {
            if (path === '/project/config.d.ts') {
              return mockModule;
            }
            return undefined;
          })
        }
      };
      
      const result = resolve_declaration_file_import('/project/config', imp, context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('Config');
      expect(result?.is_type_only).toBe(true);
    });
    
    it('should return undefined if no declaration file found', () => {
      const imp: ImportedSymbol = {
        name: 'Missing'
      };
      
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(undefined)
        }
      };
      
      const result = resolve_declaration_file_import('/project/missing', imp, context);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_type_namespace_import', () => {
    it('should collect all type-level exports', () => {
      const mockModule: ModuleNode = {
        path: '/project/types.ts',
        imports: new Map(),
        exports: new Map([
          ['MyType', {
            name: 'MyType',
            kind: 'type',
            location: { line: 1, column: 1, file_path: '/project/types.ts' }
          }],
          ['MyInterface', {
            name: 'MyInterface',
            kind: 'interface',
            location: { line: 2, column: 1, file_path: '/project/types.ts' }
          }],
          ['MyEnum', {
            name: 'MyEnum',
            kind: 'enum',
            location: { line: 3, column: 1, file_path: '/project/types.ts' }
          }],
          ['myFunction', {
            name: 'myFunction',
            kind: 'function',
            location: { line: 4, column: 1, file_path: '/project/types.ts' }
          }],
          ['myVariable', {
            name: 'myVariable',
            kind: 'variable',
            location: { line: 5, column: 1, file_path: '/project/types.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_namespace_import('Types', mockModule);
      expect(result.size).toBe(3);
      expect(result.has('MyType')).toBe(true);
      expect(result.has('MyInterface')).toBe(true);
      expect(result.has('MyEnum')).toBe(true);
      expect(result.has('myFunction')).toBe(false);
      expect(result.has('myVariable')).toBe(false);
    });
    
    it('should handle empty exports', () => {
      const mockModule: ModuleNode = {
        path: '/project/empty.ts',
        imports: new Map(),
        exports: new Map(),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_namespace_import('Empty', mockModule);
      expect(result.size).toBe(0);
    });
  });
  
  describe('resolve_module_augmentation', () => {
    it('should return empty map for module augmentation', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/augment.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      // Module augmentation tracking not yet implemented
      const result = resolve_module_augmentation('existing-module', context);
      expect(result.size).toBe(0);
    });
  });
  
  describe('resolve_ambient_module', () => {
    it('should resolve CSS module imports', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/component.tsx',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_ambient_module('styles.css', context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('default');
      expect(result?.is_default).toBe(true);
      expect(result?.is_type_only).toBe(true);
      expect(result?.location.file_path).toBe('<ambient>/styles.css');
    });
    
    it('should resolve SCSS module imports', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/component.tsx',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_ambient_module('styles.scss', context);
      expect(result).toBeDefined();
      expect(result?.location.file_path).toBe('<ambient>/styles.scss');
    });
    
    it('should resolve JSON module imports', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/config.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_ambient_module('data.json', context);
      expect(result).toBeDefined();
      expect(result?.location.file_path).toBe('<ambient>/data.json');
    });
    
    it('should resolve image imports', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/component.tsx',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      expect(resolve_ambient_module('image.png', context)).toBeDefined();
      expect(resolve_ambient_module('photo.jpg', context)).toBeDefined();
      expect(resolve_ambient_module('icon.svg', context)).toBeDefined();
    });
    
    it('should return undefined for non-ambient modules', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_ambient_module('regular-module.ts', context);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_triple_slash_reference', () => {
    it('should resolve path references', () => {
      const mockModule: ModuleNode = {
        path: '/project/types/global.d.ts',
        imports: new Map(),
        exports: new Map([
          ['GlobalType', {
            name: 'GlobalType',
            kind: 'type',
            location: { line: 1, column: 1, file_path: '/project/types/global.d.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(mockModule)
        }
      };
      
      const result = resolve_triple_slash_reference('/// <reference path="./types/global.d.ts" />', context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('*');
      expect(result?.kind).toBe('module');
    });
    
    it('should resolve types references', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_triple_slash_reference('/// <reference types="node" />', context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('node');
      expect(result?.location.file_path).toBe('@types/node');
    });
    
    it('should return undefined for invalid directives', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_triple_slash_reference('/// not a reference', context);
      expect(result).toBeUndefined();
    });
  });
  
  describe('is_type_only_import', () => {
    it('should detect type-only imports', () => {
      const typeOnlyImport: ImportedSymbol = {
        name: 'MyType',
        is_type_only: true
      };
      
      expect(is_type_only_import(typeOnlyImport)).toBe(true);
    });
    
    it('should reject regular imports', () => {
      const regularImport: ImportedSymbol = {
        name: 'myFunction',
        is_type_only: false
      };
      
      expect(is_type_only_import(regularImport)).toBe(false);
    });
    
    it('should handle undefined type-only flag', () => {
      const import_: ImportedSymbol = {
        name: 'something'
      };
      
      expect(is_type_only_import(import_)).toBe(false);
    });
  });
  
  describe('resolve_index_declaration_exports', () => {
    it('should resolve exports from index.d.ts', () => {
      const mockModule: ModuleNode = {
        path: '/project/lib/index.d.ts',
        imports: new Map(),
        exports: new Map([
          ['LibClass', {
            name: 'LibClass',
            kind: 'class',
            location: { line: 1, column: 1, file_path: '/project/lib/index.d.ts' }
          }],
          ['LibInterface', {
            name: 'LibInterface',
            kind: 'interface',
            location: { line: 2, column: 1, file_path: '/project/lib/index.d.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(mockModule)
        }
      };
      
      const result = resolve_index_declaration_exports('/project/lib', context);
      expect(result.size).toBe(2);
      
      const libClass = result.get('LibClass');
      expect(libClass).toBeDefined();
      expect(libClass?.is_type_only).toBe(true);
      
      const libInterface = result.get('LibInterface');
      expect(libInterface).toBeDefined();
      expect(libInterface?.is_type_only).toBe(true);
    });
    
    it('should return empty map if index.d.ts not found', () => {
      const context: ImportResolutionContext = {
        language: 'typescript',
        file_path: '/project/main.ts',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(undefined)
        }
      };
      
      const result = resolve_index_declaration_exports('/project/missing', context);
      expect(result.size).toBe(0);
    });
  });
});