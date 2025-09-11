/**
 * Tests for Rust bespoke import resolution
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolve_rust_special_path,
  resolve_trait_method,
  resolve_associated_function,
  resolve_pub_use_reexports,
  is_public_item,
  resolve_macro_import,
  resolve_std_import
} from './import_resolution.rust';
import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';

describe('import_resolution.rust', () => {
  describe('resolve_rust_special_path', () => {
    it('should resolve crate:: paths', () => {
      const context: ImportResolutionContext = {
        language: 'rust',
        file_path: '/project/src/module/submodule/file.rs',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_rust_special_path('crate::utils::helper', context);
      expect(result).toBe('/project/src/utils/helper');
    });
    
    it('should resolve super:: paths', () => {
      const context: ImportResolutionContext = {
        language: 'rust',
        file_path: '/project/src/module/submodule/file.rs',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_rust_special_path('super::helper', context);
      expect(result).toBe('/project/src/module/helper');
    });
    
    it('should resolve multiple super:: paths', () => {
      const context: ImportResolutionContext = {
        language: 'rust',
        file_path: '/project/src/module/submodule/deep/file.rs',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_rust_special_path('super::super::utils', context);
      expect(result).toBe('/project/src/module/utils');
    });
    
    it('should resolve self:: paths', () => {
      const context: ImportResolutionContext = {
        language: 'rust',
        file_path: '/project/src/module/file.rs',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_rust_special_path('self::submodule', context);
      expect(result).toBe('/project/src/module/submodule');
    });
    
    it('should handle std:: paths', () => {
      const context: ImportResolutionContext = {
        language: 'rust',
        file_path: '/project/src/main.rs',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_rust_special_path('std::collections::HashMap', context);
      expect(result).toBe('<std>/std::collections::HashMap');
    });
    
    it('should return null for regular paths', () => {
      const context: ImportResolutionContext = {
        language: 'rust',
        file_path: '/project/src/main.rs',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_rust_special_path('some_module::function', context);
      expect(result).toBe(null);
    });
  });
  
  describe('resolve_trait_method', () => {
    it('should resolve Clone trait methods', () => {
      const result = resolve_trait_method('MyStruct', 'clone', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('clone');
      expect(result?.kind).toBe('method');
      expect(result?.location.file_path).toBe('<trait>/Clone');
    });
    
    it('should resolve Default trait methods', () => {
      const result = resolve_trait_method('MyStruct', 'default', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('default');
      expect(result?.location.file_path).toBe('<trait>/Default');
    });
    
    it('should resolve Iterator trait methods', () => {
      const result = resolve_trait_method('MyIterator', 'next', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('next');
      expect(result?.location.file_path).toBe('<trait>/Iterator');
    });
    
    it('should return undefined for unknown trait methods', () => {
      const result = resolve_trait_method('MyStruct', 'unknown_method', {} as ImportResolutionContext);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_associated_function', () => {
    it('should resolve Vec associated functions', () => {
      const result = resolve_associated_function('Vec', 'new', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('new');
      expect(result?.kind).toBe('function');
      expect(result?.location.file_path).toBe('<type>/Vec');
    });
    
    it('should resolve String associated functions', () => {
      const result = resolve_associated_function('String', 'from', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('from');
      expect(result?.location.file_path).toBe('<type>/String');
    });
    
    it('should resolve HashMap associated functions', () => {
      const result = resolve_associated_function('HashMap', 'with_capacity', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('with_capacity');
      expect(result?.location.file_path).toBe('<type>/HashMap');
    });
    
    it('should resolve generic new constructor', () => {
      const result = resolve_associated_function('CustomType', 'new', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('new');
      expect(result?.location.file_path).toBe('<impl>/CustomType');
    });
    
    it('should resolve generic default constructor', () => {
      const result = resolve_associated_function('CustomType', 'default', {} as ImportResolutionContext);
      expect(result).toBeDefined();
      expect(result?.name).toBe('default');
      expect(result?.location.file_path).toBe('<impl>/CustomType');
    });
    
    it('should return undefined for unknown associated functions', () => {
      const result = resolve_associated_function('Vec', 'unknown_function', {} as ImportResolutionContext);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_pub_use_reexports', () => {
    it('should identify pub use re-exports', () => {
      const mockModule: ModuleNode = {
        path: '/project/src/lib.rs',
        imports: new Map(),
        exports: new Map([
          ['reexported_func', {
            name: 'reexported_func',
            kind: 'function',
            location: { line: 1, column: 1, file_path: '/project/src/lib.rs' },
            is_reexport: true,
            is_exported: true
          }],
          ['local_func', {
            name: 'local_func',
            kind: 'function',
            location: { line: 2, column: 1, file_path: '/project/src/lib.rs' },
            is_exported: true
          }],
          ['private_func', {
            name: 'private_func',
            kind: 'function',
            location: { line: 3, column: 1, file_path: '/project/src/lib.rs' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_pub_use_reexports(mockModule);
      expect(result.size).toBe(1);
      expect(result.has('reexported_func')).toBe(true);
      expect(result.has('local_func')).toBe(false);
      expect(result.has('private_func')).toBe(false);
    });
    
    it('should handle empty exports', () => {
      const mockModule: ModuleNode = {
        path: '/project/src/lib.rs',
        imports: new Map(),
        exports: new Map(),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_pub_use_reexports(mockModule);
      expect(result.size).toBe(0);
    });
  });
  
  describe('is_public_item', () => {
    it('should identify public items', () => {
      const publicItem: ExportedSymbol = {
        name: 'public_func',
        kind: 'function',
        location: { line: 1, column: 1, file_path: '/project/src/lib.rs' },
        is_exported: true
      };
      
      expect(is_public_item(publicItem)).toBe(true);
    });
    
    it('should reject private items', () => {
      const privateItem: ExportedSymbol = {
        name: 'private_func',
        kind: 'function',
        location: { line: 1, column: 1, file_path: '/project/src/lib.rs' },
        is_exported: false
      };
      
      expect(is_public_item(privateItem)).toBe(false);
    });
    
    it('should reject items without export flag', () => {
      const item: ExportedSymbol = {
        name: 'func',
        kind: 'function',
        location: { line: 1, column: 1, file_path: '/project/src/lib.rs' }
      };
      
      expect(is_public_item(item)).toBe(false);
    });
  });
  
  describe('resolve_macro_import', () => {
    it('should resolve standard macros', () => {
      expect(resolve_macro_import('println!', {} as ImportResolutionContext)).toBeDefined();
      expect(resolve_macro_import('vec!', {} as ImportResolutionContext)).toBeDefined();
      expect(resolve_macro_import('format!', {} as ImportResolutionContext)).toBeDefined();
      expect(resolve_macro_import('panic!', {} as ImportResolutionContext)).toBeDefined();
      expect(resolve_macro_import('assert!', {} as ImportResolutionContext)).toBeDefined();
      expect(resolve_macro_import('assert_eq!', {} as ImportResolutionContext)).toBeDefined();
    });
    
    it('should return correct metadata for macros', () => {
      const result = resolve_macro_import('println!', {} as ImportResolutionContext);
      expect(result?.name).toBe('println!');
      expect(result?.kind).toBe('macro');
      expect(result?.location.file_path).toBe('<std>/macros');
    });
    
    it('should return undefined for unknown macros', () => {
      const result = resolve_macro_import('custom_macro!', {} as ImportResolutionContext);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_std_import', () => {
    it('should resolve standard library imports', () => {
      const imp: ImportedSymbol = {
        name: 'HashMap'
      };
      
      const result = resolve_std_import('std::collections::HashMap', imp);
      expect(result).toBeDefined();
      expect(result.name).toBe('HashMap');
      expect(result.kind).toBe('type');
      expect(result.location.file_path).toBe('<std>/std::collections::HashMap');
    });
    
    it('should handle different std modules', () => {
      const imp: ImportedSymbol = {
        name: 'File'
      };
      
      const result = resolve_std_import('std::fs::File', imp);
      expect(result).toBeDefined();
      expect(result.name).toBe('File');
      expect(result.location.file_path).toBe('<std>/std::fs::File');
    });
    
    it('should preserve import names', () => {
      const imp: ImportedSymbol = {
        name: 'Vec',
        local_name: 'Vector'
      };
      
      const result = resolve_std_import('std::vec::Vec', imp);
      expect(result).toBeDefined();
      expect(result.name).toBe('Vec');
      expect(result.location.file_path).toBe('<std>/std::vec::Vec');
    });
  });
});