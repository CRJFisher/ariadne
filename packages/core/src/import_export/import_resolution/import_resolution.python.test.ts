/**
 * Tests for Python bespoke import resolution
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolve_python_relative_import,
  resolve_all_exports,
  resolve_init_package_exports,
  resolve_builtin_member,
  is_python_builtin,
  resolve_wildcard_import
} from './import_resolution.python';
import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';

describe('import_resolution.python', () => {
  describe('resolve_python_relative_import', () => {
    it('should resolve single dot relative imports', () => {
      const imp: ImportedSymbol = { name: 'module' };
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/package/subpackage/file.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_python_relative_import(imp, '.module', context);
      expect(result).toBe('/project/package/subpackage/module');
    });
    
    it('should resolve double dot relative imports', () => {
      const imp: ImportedSymbol = { name: 'module' };
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/package/subpackage/file.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_python_relative_import(imp, '..module', context);
      expect(result).toBe('/project/package/module');
    });
    
    it('should resolve triple dot relative imports', () => {
      const imp: ImportedSymbol = { name: 'module' };
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/package/subpackage/deep/file.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_python_relative_import(imp, '...module', context);
      expect(result).toBe('/project/package/module');
    });
    
    it('should handle relative imports without module name', () => {
      const imp: ImportedSymbol = { name: 'something' };
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/package/file.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_python_relative_import(imp, '.', context);
      expect(result).toBe('/project/package');
    });
    
    it('should return null for non-relative imports', () => {
      const imp: ImportedSymbol = { name: 'module' };
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/file.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_python_relative_import(imp, 'module', context);
      expect(result).toBe(null);
    });
  });
  
  describe('resolve_all_exports', () => {
    it('should return empty set when no __all__ defined', () => {
      const mockModule: ModuleNode = {
        path: '/project/module.py',
        imports: new Map(),
        exports: new Map([
          ['public_func', { name: 'public_func', kind: 'function', location: { line: 1, column: 1, file_path: '/project/module.py' } }],
          ['_private_func', { name: '_private_func', kind: 'function', location: { line: 2, column: 1, file_path: '/project/module.py' } }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_all_exports(mockModule);
      expect(result.size).toBe(1);
      expect(result.has('public_func')).toBe(true);
      expect(result.has('_private_func')).toBe(false);
    });
    
    it('should handle __all__ export list', () => {
      const mockModule: ModuleNode = {
        path: '/project/module.py',
        imports: new Map(),
        exports: new Map([
          ['__all__', { name: '__all__', kind: 'variable', location: { line: 1, column: 1, file_path: '/project/module.py' } }],
          ['public_func', { name: 'public_func', kind: 'function', location: { line: 2, column: 1, file_path: '/project/module.py' } }],
          ['another_func', { name: 'another_func', kind: 'function', location: { line: 3, column: 1, file_path: '/project/module.py' } }],
          ['_private_func', { name: '_private_func', kind: 'function', location: { line: 4, column: 1, file_path: '/project/module.py' } }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      // When __all__ is defined, we return all non-underscore exports
      // (In real implementation, would parse __all__ list from AST)
      const result = resolve_all_exports(mockModule);
      expect(result.has('public_func')).toBe(true);
      expect(result.has('another_func')).toBe(true);
      expect(result.has('_private_func')).toBe(false);
    });
  });
  
  describe('resolve_init_package_exports', () => {
    it('should resolve exports from __init__.py', () => {
      const mockInitModule: ModuleNode = {
        path: '/project/package/__init__.py',
        imports: new Map(),
        exports: new Map([
          ['PackageClass', { name: 'PackageClass', kind: 'class', location: { line: 1, column: 1, file_path: '/project/package/__init__.py' } }],
          ['package_func', { name: 'package_func', kind: 'function', location: { line: 2, column: 1, file_path: '/project/package/__init__.py' } }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/main.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(mockInitModule)
        }
      };
      
      const result = resolve_init_package_exports('/project/package', context);
      expect(result.size).toBe(2);
      expect(result.has('PackageClass')).toBe(true);
      expect(result.has('package_func')).toBe(true);
    });
    
    it('should handle missing __init__.py', () => {
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/main.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockReturnValue(undefined)
        }
      };
      
      const result = resolve_init_package_exports('/project/package', context);
      expect(result.size).toBe(0);
    });
  });
  
  describe('is_python_builtin', () => {
    it('should detect Python builtin modules', () => {
      expect(is_python_builtin('os')).toBe(true);
      expect(is_python_builtin('sys')).toBe(true);
      expect(is_python_builtin('json')).toBe(true);
      expect(is_python_builtin('datetime')).toBe(true);
      expect(is_python_builtin('os.path')).toBe(true);
      expect(is_python_builtin('collections.abc')).toBe(true);
    });
    
    it('should reject non-builtin modules', () => {
      expect(is_python_builtin('numpy')).toBe(false);
      expect(is_python_builtin('pandas')).toBe(false);
      expect(is_python_builtin('mymodule')).toBe(false);
      expect(is_python_builtin('requests')).toBe(false);
    });
  });
  
  describe('resolve_builtin_member', () => {
    it('should resolve known builtin module members', () => {
      const result = resolve_builtin_member('os', 'path');
      expect(result).toBeDefined();
      expect(result?.name).toBe('path');
      expect(result?.location.file_path).toBe('<builtin>/os');
    });
    
    it('should resolve sys module members', () => {
      const result = resolve_builtin_member('sys', 'argv');
      expect(result).toBeDefined();
      expect(result?.name).toBe('argv');
      expect(result?.location.file_path).toBe('<builtin>/sys');
    });
    
    it('should resolve math module members', () => {
      const result = resolve_builtin_member('math', 'pi');
      expect(result).toBeDefined();
      expect(result?.name).toBe('pi');
      expect(result?.location.file_path).toBe('<builtin>/math');
    });
    
    it('should return undefined for unknown members', () => {
      const result = resolve_builtin_member('os', 'unknown_function');
      expect(result).toBeUndefined();
    });
    
    it('should return undefined for unknown modules', () => {
      const result = resolve_builtin_member('unknown_module', 'func');
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_wildcard_import', () => {
    it('should resolve from module import * for absolute imports', () => {
      const mockModule: ModuleNode = {
        path: '/project/utils.py',
        imports: new Map(),
        exports: new Map([
          ['util_func', { name: 'util_func', kind: 'function', location: { line: 1, column: 1, file_path: '/project/utils.py' } }],
          ['UtilClass', { name: 'UtilClass', kind: 'class', location: { line: 2, column: 1, file_path: '/project/utils.py' } }],
          ['_private', { name: '_private', kind: 'function', location: { line: 3, column: 1, file_path: '/project/utils.py' } }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/main.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockImplementation(path => {
            if (path === 'utils.py' || path === 'utils/__init__.py') {
              return mockModule;
            }
            return undefined;
          })
        }
      };
      
      const result = resolve_wildcard_import('utils', context);
      expect(result.size).toBe(2);
      expect(result.has('util_func')).toBe(true);
      expect(result.has('UtilClass')).toBe(true);
      expect(result.has('_private')).toBe(false);
    });
    
    it('should resolve from . import * for relative imports', () => {
      const mockModule: ModuleNode = {
        path: '/project/package/module.py',
        imports: new Map(),
        exports: new Map([
          ['func1', { name: 'func1', kind: 'function', location: { line: 1, column: 1, file_path: '/project/package/module.py' } }],
          ['func2', { name: 'func2', kind: 'function', location: { line: 2, column: 1, file_path: '/project/package/module.py' } }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const context: ImportResolutionContext = {
        language: 'python',
        file_path: '/project/package/other.py',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn().mockImplementation(path => {
            if (path === '/project/package.py' || path === '/project/package/__init__.py') {
              return mockModule;
            }
            return undefined;
          })
        }
      };
      
      const result = resolve_wildcard_import('.', context);
      expect(result.size).toBe(2);
      expect(result.has('func1')).toBe(true);
      expect(result.has('func2')).toBe(true);
    });
  });
});