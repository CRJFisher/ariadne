/**
 * Tests for generic import resolution processor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detect_import_type,
  resolve_module_path_generic,
  resolve_import_generic,
  resolve_all_imports_generic,
  is_index_file_generic,
  clear_resolution_cache,
  set_debug_mode,
  set_cache_mode,
  MODULE_CONTEXT
} from './import_resolution';
import { get_import_config } from './language_configs';
import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionConfig, ImportResolutionContext } from './import_resolution';

describe('import_resolution', () => {
  beforeEach(() => {
    clear_resolution_cache();
    set_debug_mode(false);
    set_cache_mode(true);
  });
  
  describe('detect_import_type', () => {
    it('should detect namespace imports', () => {
      const jsConfig = get_import_config('javascript');
      
      const namespaceImport: ImportedSymbol = {
        name: '*',
        is_namespace: true
      };
      
      const result = detect_import_type(namespaceImport, jsConfig);
      expect(result.is_namespace).toBe(true);
      expect(result.is_default).toBe(false);
      expect(result.is_named).toBe(false);
    });
    
    it('should detect default imports', () => {
      const jsConfig = get_import_config('javascript');
      
      const defaultImport: ImportedSymbol = {
        name: 'default',
        is_default: true
      };
      
      const result = detect_import_type(defaultImport, jsConfig);
      expect(result.is_namespace).toBe(false);
      expect(result.is_default).toBe(true);
      expect(result.is_named).toBe(false);
    });
    
    it('should detect named imports', () => {
      const jsConfig = get_import_config('javascript');
      
      const namedImport: ImportedSymbol = {
        name: 'foo'
      };
      
      const result = detect_import_type(namedImport, jsConfig);
      expect(result.is_namespace).toBe(false);
      expect(result.is_default).toBe(false);
      expect(result.is_named).toBe(true);
    });
    
    it('should detect namespace by marker', () => {
      const pyConfig = get_import_config('python');
      
      const wildcardImport: ImportedSymbol = {
        name: '*'
      };
      
      const result = detect_import_type(wildcardImport, pyConfig);
      expect(result.is_namespace).toBe(true);
    });
  });
  
  describe('resolve_module_path_generic', () => {
    it('should resolve JavaScript relative paths', () => {
      const jsConfig = get_import_config('javascript');
      
      expect(resolve_module_path_generic(
        '/project/src/index.js',
        './utils',
        jsConfig
      )).toBe('/project/src/utils');
      
      expect(resolve_module_path_generic(
        '/project/src/components/Button.js',
        '../utils',
        jsConfig
      )).toBe('/project/src/utils');
    });
    
    it('should return null for external modules', () => {
      const jsConfig = get_import_config('javascript');
      
      expect(resolve_module_path_generic(
        '/project/src/index.js',
        'react',
        jsConfig
      )).toBe(null);
      
      expect(resolve_module_path_generic(
        '/project/src/index.js',
        '@babel/core',
        jsConfig
      )).toBe(null);
    });
    
    it('should preserve special prefixes for Rust', () => {
      const rustConfig = get_import_config('rust');
      
      expect(resolve_module_path_generic(
        '/project/src/main.rs',
        'crate::utils',
        rustConfig
      )).toBe('crate::utils');
      
      expect(resolve_module_path_generic(
        '/project/src/lib.rs',
        'std::collections',
        rustConfig
      )).toBe('std::collections');
    });
    
    it('should convert Python module paths', () => {
      const pyConfig = get_import_config('python');
      
      const result = resolve_module_path_generic(
        '/project/main.py',
        'package.module',
        pyConfig
      );
      
      expect(result).toBe('package/module');
    });
  });
  
  describe('resolve_import_generic', () => {
    it('should resolve imports with caching', () => {
      const jsConfig = get_import_config('javascript');
      
      const mockExport: ExportedSymbol = {
        name: 'foo',
        kind: 'function',
        location: { line: 1, column: 1, file_path: '/project/utils.js' }
      };
      
      const mockModule: ModuleNode = {
        path: '/project/utils.js',
        imports: new Map(),
        exports: new Map([['foo', mockExport]]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const mockConfig: ImportResolutionConfig = {
        get_module_graph: vi.fn(),
        get_module_node: vi.fn((path) => {
          if (path === '/project/index.js') {
            return {
              path: '/project/index.js',
              imports: new Map([
                ['./utils', { 
                  symbols: [{ name: 'foo' }], 
                  source: './utils' 
                }]
              ]),
              exports: new Map(),
              internal_calls: new Map(),
              external_calls: new Map()
            };
          }
          if (path === '/project/utils.js') {
            return mockModule;
          }
          return undefined;
        })
      };
      
      const context: ImportResolutionContext = {
        language: 'javascript',
        file_path: '/project/index.js',
        config: mockConfig
      };
      
      const imp: ImportedSymbol = { name: 'foo' };
      
      // First call should resolve
      const result1 = resolve_import_generic(imp, context, jsConfig);
      expect(result1).toBeDefined();
      expect(result1?.name).toBe('foo');
      
      // Second call should use cache
      const result2 = resolve_import_generic(imp, context, jsConfig);
      expect(result2).toBe(result1);
      
      // Verify module_node was called appropriately
      expect(mockConfig.get_module_node).toHaveBeenCalled();
    });
    
    it('should handle namespace imports', () => {
      const jsConfig = get_import_config('javascript');
      
      const mockConfig: ImportResolutionConfig = {
        get_module_graph: vi.fn(),
        get_module_node: vi.fn((path) => {
          if (path === '/project/index.js') {
            return {
              path: '/project/index.js',
              imports: new Map([
                ['./utils', { 
                  symbols: [{ name: 'utils', is_namespace: true }], 
                  source: './utils' 
                }]
              ]),
              exports: new Map(),
              internal_calls: new Map(),
              external_calls: new Map()
            };
          }
          if (path === '/project/utils.js') {
            return {
              path: '/project/utils.js',
              imports: new Map(),
              exports: new Map(),
              internal_calls: new Map(),
              external_calls: new Map()
            };
          }
          return undefined;
        })
      };
      
      const context: ImportResolutionContext = {
        language: 'javascript',
        file_path: '/project/index.js',
        config: mockConfig
      };
      
      const imp: ImportedSymbol = { name: 'utils', is_namespace: true };
      
      const result = resolve_import_generic(imp, context, jsConfig);
      expect(result).toBeDefined();
      expect(result?.kind).toBe('variable');
    });
  });
  
  describe('is_index_file_generic', () => {
    it('should detect JavaScript index files', () => {
      const jsConfig = get_import_config('javascript');
      expect(is_index_file_generic('src/index.js', jsConfig)).toBe(true);
      expect(is_index_file_generic('src/index.jsx', jsConfig)).toBe(true);
      expect(is_index_file_generic('src/main.js', jsConfig)).toBe(false);
    });
    
    it('should detect TypeScript index files', () => {
      const tsConfig = get_import_config('typescript');
      expect(is_index_file_generic('src/index.ts', tsConfig)).toBe(true);
      expect(is_index_file_generic('src/index.tsx', tsConfig)).toBe(true);
      expect(is_index_file_generic('src/app.ts', tsConfig)).toBe(false);
    });
    
    it('should detect Python index files', () => {
      const pyConfig = get_import_config('python');
      expect(is_index_file_generic('package/__init__.py', pyConfig)).toBe(true);
      expect(is_index_file_generic('package/module.py', pyConfig)).toBe(false);
    });
    
    it('should detect Rust index files', () => {
      const rustConfig = get_import_config('rust');
      expect(is_index_file_generic('src/mod.rs', rustConfig)).toBe(true);
      expect(is_index_file_generic('src/lib.rs', rustConfig)).toBe(true);
      expect(is_index_file_generic('src/main.rs', rustConfig)).toBe(false);
    });
  });
  
  describe('cache management', () => {
    it('should clear cache when disabled', () => {
      const jsConfig = get_import_config('javascript');
      
      // Add something to cache
      MODULE_CONTEXT.resolution_cache.set('test:key', {} as ExportedSymbol);
      expect(MODULE_CONTEXT.resolution_cache.size).toBe(1);
      
      // Disable cache
      set_cache_mode(false);
      expect(MODULE_CONTEXT.resolution_cache.size).toBe(0);
      
      // Re-enable cache
      set_cache_mode(true);
      expect(MODULE_CONTEXT.cache_enabled).toBe(true);
    });
    
    it('should clear cache manually', () => {
      MODULE_CONTEXT.resolution_cache.set('test:key', {} as ExportedSymbol);
      expect(MODULE_CONTEXT.resolution_cache.size).toBe(1);
      
      clear_resolution_cache();
      expect(MODULE_CONTEXT.resolution_cache.size).toBe(0);
    });
  });
  
  describe('debug mode', () => {
    it('should toggle debug mode', () => {
      expect(MODULE_CONTEXT.debug_enabled).toBe(false);
      
      set_debug_mode(true);
      expect(MODULE_CONTEXT.debug_enabled).toBe(true);
      
      set_debug_mode(false);
      expect(MODULE_CONTEXT.debug_enabled).toBe(false);
    });
  });
  
  describe('resolve_all_imports_generic', () => {
    it('should resolve all imports in a file', () => {
      const mockConfig: ImportResolutionConfig = {
        get_module_graph: vi.fn(),
        get_module_node: vi.fn((path) => {
          if (path === '/project/index.js') {
            return {
              path: '/project/index.js',
              imports: new Map([
                ['./utils', { 
                  symbols: [
                    { name: 'foo' },
                    { name: 'bar', local_name: 'baz' }
                  ], 
                  source: './utils' 
                }]
              ]),
              exports: new Map(),
              internal_calls: new Map(),
              external_calls: new Map()
            };
          }
          if (path === '/project/utils.js') {
            return {
              path: '/project/utils.js',
              imports: new Map(),
              exports: new Map([
                ['foo', { name: 'foo', kind: 'function', location: { line: 1, column: 1, file_path: '/project/utils.js' } }],
                ['bar', { name: 'bar', kind: 'variable', location: { line: 2, column: 1, file_path: '/project/utils.js' } }]
              ]),
              internal_calls: new Map(),
              external_calls: new Map()
            };
          }
          return undefined;
        })
      };
      
      const results = resolve_all_imports_generic(
        '/project/index.js',
        mockConfig,
        'javascript'
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].import_statement.name).toBe('foo');
      expect(results[0].local_name).toBe('foo');
      expect(results[1].import_statement.name).toBe('bar');
      expect(results[1].local_name).toBe('baz');
    });
  });
});