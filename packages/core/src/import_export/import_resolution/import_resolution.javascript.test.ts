/**
 * Tests for JavaScript/TypeScript bespoke import resolution
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolve_commonjs_require,
  resolve_dynamic_import,
  resolve_type_only_import,
  resolve_reexport_pattern,
  is_commonjs_file,
  resolve_module_exports
} from './import_resolution.javascript';
import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';
import Parser from 'tree-sitter';
// @ts-ignore
import JavaScript from 'tree-sitter-javascript';

describe('import_resolution.javascript', () => {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  
  describe('resolve_commonjs_require', () => {
    it('should resolve simple require() calls', () => {
      const code = `const utils = require('./utils');`;
      const tree = parser.parse(code);
      
      // Find the call_expression node
      let requireNode: any = null;
      const cursor = tree.walk();
      
      const findRequire = () => {
        if (cursor.currentNode.type === 'call_expression') {
          const funcNode = cursor.currentNode.childForFieldName('function');
          if (funcNode && funcNode.text === 'require') {
            requireNode = cursor.currentNode;
            return true;
          }
        }
        
        if (cursor.gotoFirstChild()) {
          do {
            if (findRequire()) return true;
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
        return false;
      };
      
      findRequire();
      
      if (requireNode) {
        const context: ImportResolutionContext = {
          language: 'javascript',
          file_path: '/project/index.js',
          config: {
            get_module_graph: vi.fn(),
            get_module_node: vi.fn()
          }
        };
        
        const result = resolve_commonjs_require(requireNode, code, context);
        expect(result).toBeDefined();
        expect(result?.name).toBe('module.exports');
        expect(result?.is_default).toBe(true);
      }
    });
    
    it('should return undefined for non-require calls', () => {
      const code = `const result = someFunction('./path');`;
      const tree = parser.parse(code);
      
      const cursor = tree.walk();
      cursor.gotoFirstChild();
      
      const context: ImportResolutionContext = {
        language: 'javascript',
        file_path: '/project/index.js',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_commonjs_require(cursor.currentNode, code, context);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_dynamic_import', () => {
    it('should handle static dynamic imports', () => {
      const imp: ImportedSymbol = {
        name: './module'
      };
      
      const context: ImportResolutionContext = {
        language: 'javascript',
        file_path: '/project/index.js',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_dynamic_import(imp, context);
      expect(result).toBeDefined();
      expect(result?.name).toBe('*');
      expect(result?.kind).toBe('module');
    });
    
    it('should return undefined for template literal imports', () => {
      const imp: ImportedSymbol = {
        name: '`./module/${version}`'
      };
      
      const context: ImportResolutionContext = {
        language: 'javascript',
        file_path: '/project/index.js',
        config: {
          get_module_graph: vi.fn(),
          get_module_node: vi.fn()
        }
      };
      
      const result = resolve_dynamic_import(imp, context);
      expect(result).toBeUndefined();
    });
  });
  
  describe('resolve_type_only_import', () => {
    it('should resolve type-only imports', () => {
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
            kind: 'type',
            location: { line: 1, column: 1, file_path: '/project/types.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_only_import(imp, mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('MyType');
      expect(result?.kind).toBe('type');
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
    
    it('should handle value imports used as types', () => {
      const imp: ImportedSymbol = {
        name: 'MyClass',
        is_type_only: true
      };
      
      const mockModule: ModuleNode = {
        path: '/project/classes.ts',
        imports: new Map(),
        exports: new Map([
          ['MyClass', {
            name: 'MyClass',
            kind: 'class',
            location: { line: 1, column: 1, file_path: '/project/classes.ts' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_type_only_import(imp, mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('MyClass');
      expect(result?.is_type_only).toBe(true);
    });
  });
  
  describe('resolve_reexport_pattern', () => {
    it('should identify re-exported symbols', () => {
      const mockModule: ModuleNode = {
        path: '/project/reexports.js',
        imports: new Map(),
        exports: new Map([
          ['foo', {
            name: 'foo',
            kind: 'function',
            location: { line: 1, column: 1, file_path: '/project/reexports.js' },
            is_reexport: true
          }],
          ['bar', {
            name: 'bar',
            kind: 'variable',
            location: { line: 2, column: 1, file_path: '/project/reexports.js' },
            is_reexport: false
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_reexport_pattern(mockModule, './source');
      expect(result.size).toBe(1);
      expect(result.has('foo')).toBe(true);
      expect(result.has('bar')).toBe(false);
    });
  });
  
  describe('is_commonjs_file', () => {
    it('should detect .cjs files as CommonJS', () => {
      expect(is_commonjs_file('/project/module.cjs')).toBe(true);
    });
    
    it('should detect .mjs files as ES modules', () => {
      expect(is_commonjs_file('/project/module.mjs')).toBe(false);
    });
    
    it('should use heuristic for .js files', () => {
      expect(is_commonjs_file('/project/module.js')).toBe(false);
    });
  });
  
  describe('resolve_module_exports', () => {
    it('should find module.exports', () => {
      const mockModule: ModuleNode = {
        path: '/project/commonjs.js',
        imports: new Map(),
        exports: new Map([
          ['module.exports', {
            name: 'module.exports',
            kind: 'variable',
            location: { line: 1, column: 1, file_path: '/project/commonjs.js' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_module_exports(mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('module.exports');
    });
    
    it('should find exports object', () => {
      const mockModule: ModuleNode = {
        path: '/project/commonjs.js',
        imports: new Map(),
        exports: new Map([
          ['exports', {
            name: 'exports',
            kind: 'variable',
            location: { line: 1, column: 1, file_path: '/project/commonjs.js' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_module_exports(mockModule);
      expect(result).toBeDefined();
      expect(result?.name).toBe('exports');
    });
    
    it('should return undefined if no CommonJS exports found', () => {
      const mockModule: ModuleNode = {
        path: '/project/esmodule.js',
        imports: new Map(),
        exports: new Map([
          ['default', {
            name: 'default',
            kind: 'function',
            location: { line: 1, column: 1, file_path: '/project/esmodule.js' }
          }]
        ]),
        internal_calls: new Map(),
        external_calls: new Map()
      };
      
      const result = resolve_module_exports(mockModule);
      expect(result).toBeUndefined();
    });
  });
});